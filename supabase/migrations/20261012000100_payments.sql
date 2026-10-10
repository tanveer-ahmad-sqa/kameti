-- Phase 4: payment tracking, late status job, automatic committee completion.
--
-- Payment status flow (all changes logged by the payments audit trigger):
--   pending ──(member: "I've paid")──▶ awaiting_confirmation ──(organizer: confirm)──▶ paid
--   pending/late ──(organizer: mark paid)──▶ paid
--   awaiting_confirmation ──(organizer: reject)──▶ pending | late
--   paid ──(organizer: undo)──▶ pending | late
--   pending ──(nightly job after the due date)──▶ late

create extension if not exists pg_cron;

-- pending/late depending on whether the due date (a Karachi calendar day) has passed.
create function private.unpaid_status_for(p_due_date date)
returns public.payment_status
language sql
stable
set search_path = ''
as $$
  select case
    when p_due_date < (now() at time zone 'Asia/Karachi')::date then 'late'::public.payment_status
    else 'pending'::public.payment_status
  end;
$$;

-- Loads and locks a payment with its cycle due date and committee.
create function private.lock_payment(p_payment_id uuid)
returns table (payment public.payments, due_date date, committee public.committees)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select p, c.due_date, k
  from public.payments p
  join public.cycles c on c.id = p.cycle_id
  join public.committees k on k.id = p.committee_id
  where p.id = p_payment_id
  for update of p;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- Member: "I've paid"
-------------------------------------------------------------------------------
create function public.claim_payment(
  p_payment_id uuid,
  p_method public.payment_method default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  select * into v_row from private.lock_payment(p_payment_id);
  -- Only the member who owes this payment can claim it (and only if they can see it).
  if not exists (
    select 1 from public.committee_members m
    where m.id = (v_row.payment).member_id and m.user_id = auth.uid()
  ) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if (v_row.committee).status <> 'active' then
    raise exception using errcode = 'P0001', message = 'committee_not_active';
  end if;
  if (v_row.payment).status = 'paid' then
    raise exception using errcode = 'P0001', message = 'payment_already_paid';
  end if;
  if (v_row.payment).status = 'awaiting_confirmation' then
    raise exception using errcode = 'P0001', message = 'payment_already_claimed';
  end if;

  update public.payments
  set status = 'awaiting_confirmation', claimed_at = now(), claimed_by = auth.uid(),
      method = coalesce(p_method, method),
      note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
  where id = p_payment_id;
end;
$$;

-------------------------------------------------------------------------------
-- Organizer actions
-------------------------------------------------------------------------------
-- Organizer checks for a payment's committee. Outsiders get not_found (no existence leak).
create function private.assert_payment_organizer(p_committee public.committees)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if not private.is_committee_participant(p_committee.id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if p_committee.organizer_id is distinct from auth.uid() then
    raise exception using errcode = 'P0001', message = 'not_organizer';
  end if;
  if p_committee.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'committee_not_active';
  end if;
end;
$$;

-- Mark paid directly, or confirm a member's claim. Method and note are optional.
create function public.confirm_payment(
  p_payment_id uuid,
  p_method public.payment_method default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select * into v_row from private.lock_payment(p_payment_id);
  perform private.assert_payment_organizer(v_row.committee);
  if (v_row.payment).status = 'paid' then
    raise exception using errcode = 'P0001', message = 'payment_already_paid';
  end if;
  update public.payments
  set status = 'paid', paid_at = now(), confirmed_by = auth.uid(),
      method = coalesce(p_method, method),
      note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
  where id = p_payment_id;
end;
$$;

-- The organizer didn't receive the money: back to pending/late, claim cleared.
create function public.reject_payment_claim(p_payment_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select * into v_row from private.lock_payment(p_payment_id);
  perform private.assert_payment_organizer(v_row.committee);
  if (v_row.payment).status <> 'awaiting_confirmation' then
    raise exception using errcode = 'P0001', message = 'payment_not_claimed';
  end if;
  update public.payments
  set status = private.unpaid_status_for(v_row.due_date), claimed_at = null, claimed_by = null,
      note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
  where id = p_payment_id;
end;
$$;

-- Undo a payment marked paid by mistake.
create function public.revert_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select * into v_row from private.lock_payment(p_payment_id);
  perform private.assert_payment_organizer(v_row.committee);
  if (v_row.payment).status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'payment_not_paid';
  end if;
  update public.payments
  set status = private.unpaid_status_for(v_row.due_date), paid_at = null, confirmed_by = null,
      claimed_at = null, claimed_by = null
  where id = p_payment_id;
end;
$$;

-------------------------------------------------------------------------------
-- Late job: pending payments whose due date has passed (Karachi) become late.
-- Runs nightly at 00:05 Asia/Karachi (19:05 UTC); actor is "system" (NULL).
-------------------------------------------------------------------------------
create function private.mark_late_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payments p
  set status = 'late'
  from public.cycles c, public.committees k
  where c.id = p.cycle_id
    and k.id = p.committee_id
    and k.status = 'active'
    and p.status = 'pending'
    and c.due_date < (now() at time zone 'Asia/Karachi')::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('kameti-mark-late-payments', '5 19 * * *', $$select private.mark_late_payments()$$);

-------------------------------------------------------------------------------
-- A committee completes once every payout is done and every payment is paid.
-------------------------------------------------------------------------------
create function private.maybe_complete_committee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.committees k where k.id = new.committee_id and k.status = 'active')
     and not exists (
       select 1 from public.cycles c where c.committee_id = new.committee_id and c.payout_status <> 'completed'
     )
     and not exists (
       select 1 from public.payments p where p.committee_id = new.committee_id and p.status <> 'paid'
     ) then
    update public.committees set status = 'completed', completed_at = now() where id = new.committee_id;
  end if;
  return null;
end;
$$;

create trigger cycles_maybe_complete
after update of payout_status on public.cycles
for each row when (new.payout_status = 'completed')
execute function private.maybe_complete_committee();

create trigger payments_maybe_complete
after update of status on public.payments
for each row when (new.status = 'paid')
execute function private.maybe_complete_committee();

-------------------------------------------------------------------------------
-- Privileges
-------------------------------------------------------------------------------
revoke execute on function public.claim_payment(uuid, public.payment_method, text) from public, anon;
revoke execute on function public.confirm_payment(uuid, public.payment_method, text) from public, anon;
revoke execute on function public.reject_payment_claim(uuid, text) from public, anon;
revoke execute on function public.revert_payment(uuid) from public, anon;
grant execute on function public.claim_payment(uuid, public.payment_method, text) to authenticated;
grant execute on function public.confirm_payment(uuid, public.payment_method, text) to authenticated;
grant execute on function public.reject_payment_claim(uuid, text) to authenticated;
grant execute on function public.revert_payment(uuid) to authenticated;
