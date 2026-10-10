-- Phase 3: payout order (manual, member choice, server-side random draw), activation,
-- payout completion and logged order changes after activation.

-------------------------------------------------------------------------------
-- Bulk order changes are logged once by the RPC (with the full order), not once per member.
-------------------------------------------------------------------------------
create function private.is_bulk_order_change()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('kameti.bulk_order_change', true), '') = 'on';
$$;

create or replace function private.audit_committee_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.committee_id, 'member.added', 'member', new.id,
      jsonb_build_object('display_name', new.display_name, 'turn_number', new.turn_number));
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.log_activity(old.committee_id, 'member.removed', 'member', old.id,
      jsonb_build_object('display_name', old.display_name));
    return old;
  end if;

  if new.is_former_user and not old.is_former_user then
    perform private.log_activity(new.committee_id, 'member.account_deleted', 'member', new.id, '{}'::jsonb);
    return new;
  end if;

  if new.user_id is not null and old.user_id is null
     and new.phone is not distinct from old.phone then
    perform private.log_activity(new.committee_id, 'member.joined', 'member', new.id,
      jsonb_build_object('display_name', new.display_name));
    return new;
  end if;

  v_changes := private.jsonb_changes(
    to_jsonb(old) - 'phone' - 'user_id',
    to_jsonb(new) - 'phone' - 'user_id'
  );
  if new.phone is distinct from old.phone then
    v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('changed', true));
  end if;
  if v_changes = '{}'::jsonb then
    return new;
  end if;

  if v_changes ? 'turn_number' and (v_changes - 'turn_number') = '{}'::jsonb then
    if private.is_bulk_order_change() then
      return new; -- the calling RPC logs the whole order once
    end if;
    perform private.log_activity(new.committee_id, 'member.turn_changed', 'member', new.id,
      jsonb_build_object('display_name', new.display_name, 'changes', v_changes));
    return new;
  end if;

  perform private.log_activity(new.committee_id, 'member.updated', 'member', new.id,
    jsonb_build_object('display_name', new.display_name, 'changes', v_changes));
  return new;
end;
$$;

create or replace function private.audit_cycles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payout_status is distinct from old.payout_status then
    perform private.log_activity(new.committee_id,
      case new.payout_status when 'completed' then 'payout.completed' else 'payout.reverted' end,
      'cycle', new.id,
      jsonb_build_object('cycle_number', new.cycle_number, 'recipient_member_id', new.recipient_member_id,
        'note', new.payout_note));
  elsif new.recipient_member_id is distinct from old.recipient_member_id
        and not private.is_bulk_order_change() then
    perform private.log_activity(new.committee_id, 'payout.recipient_changed', 'cycle', new.id,
      jsonb_build_object('cycle_number', new.cycle_number,
        'from', old.recipient_member_id, 'to', new.recipient_member_id));
  end if;
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

-- Loads and locks a committee, checking the actor is its organizer and its status.
create function private.lock_committee_for_organizer(
  p_committee_id uuid,
  p_actor uuid,
  p_required_status public.committee_status
)
returns public.committees
language plpgsql
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
begin
  if p_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  select * into v_committee from public.committees c where c.id = p_committee_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_committee.organizer_id is distinct from p_actor then
    raise exception using errcode = 'P0001', message = 'not_organizer';
  end if;
  if v_committee.status <> p_required_status then
    raise exception using errcode = 'P0001',
      message = case p_required_status when 'draft' then 'committee_not_draft' else 'committee_not_active' end;
  end if;
  return v_committee;
end;
$$;

-- Turn n of a committee falls in month start_month + (n - 1).
create function private.cycle_date(p_start_month date, p_turn integer, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_start_month + make_interval(months => p_turn - 1) + make_interval(days => p_day - 1))::date;
$$;

-- Rewrites all turns of a committee from an ordered list of member ids (1-based).
create function private.write_order(p_committee_id uuid, p_member_ids uuid[])
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform set_config('kameti.bulk_order_change', 'on', true);
  update public.committee_members m set turn_number = null
  where m.committee_id = p_committee_id and m.turn_number is not null;
  update public.committee_members m
  set turn_number = o.position
  from unnest(p_member_ids) with ordinality as o(member_id, position)
  where m.id = o.member_id and m.committee_id = p_committee_id;
  perform set_config('kameti.bulk_order_change', 'off', true);

  select jsonb_agg(jsonb_build_object('turn_number', o.position, 'member_id', o.member_id,
           'display_name', m.display_name) order by o.position)
  into v_result
  from unnest(p_member_ids) with ordinality as o(member_id, position)
  join public.committee_members m on m.id = o.member_id;
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- True when p_member_ids is exactly the committee's members (each once).
create function private.is_full_member_set(p_committee_id uuid, p_member_ids uuid[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(array_length(p_member_ids, 1), 0) = (select count(distinct x) from unnest(p_member_ids) x)
     and coalesce(array_length(p_member_ids, 1), 0) =
         (select count(*) from public.committee_members m where m.committee_id = p_committee_id)
     and not exists (
       select 1 from unnest(p_member_ids) x
       where not exists (
         select 1 from public.committee_members m where m.id = x and m.committee_id = p_committee_id
       )
     );
$$;

-------------------------------------------------------------------------------
-- Manual order (organizer, draft, method = manual)
-------------------------------------------------------------------------------
create function public.set_payout_order(p_committee_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
  v_order jsonb;
begin
  v_committee := private.lock_committee_for_organizer(p_committee_id, auth.uid(), 'draft');
  if v_committee.payout_order_method <> 'manual' then
    raise exception using errcode = 'P0001', message = 'order_method_mismatch';
  end if;
  if not private.is_full_member_set(p_committee_id, p_member_ids) then
    raise exception using errcode = 'P0001', message = 'invalid_order';
  end if;
  v_order := private.write_order(p_committee_id, p_member_ids);
  perform private.log_activity(p_committee_id, 'order.set', 'committee', p_committee_id,
    jsonb_build_object('order', v_order));
end;
$$;

-------------------------------------------------------------------------------
-- Member choice: organizer assigns/clears any turn; members pick/release their own.
-------------------------------------------------------------------------------
create function public.assign_turn(p_committee_id uuid, p_member_id uuid, p_turn smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
begin
  v_committee := private.lock_committee_for_organizer(p_committee_id, auth.uid(), 'draft');
  if v_committee.payout_order_method <> 'member_choice' then
    raise exception using errcode = 'P0001', message = 'order_method_mismatch';
  end if;
  if p_turn is not null and exists (
    select 1 from public.committee_members m
    where m.committee_id = p_committee_id and m.turn_number = p_turn and m.id <> p_member_id
  ) then
    raise exception using errcode = 'P0001', message = 'turn_taken';
  end if;
  update public.committee_members m set turn_number = p_turn
  where m.id = p_member_id and m.committee_id = p_committee_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
end;
$$;

create function public.choose_turn(p_committee_id uuid, p_turn smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  select * into v_committee from public.committees c where c.id = p_committee_id for update;
  select m.id into v_member_id from public.committee_members m
  where m.committee_id = p_committee_id and m.user_id = auth.uid();
  if not found or v_committee.id is null then
    raise exception using errcode = 'P0001', message = 'not_a_member';
  end if;
  if v_committee.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'committee_not_draft';
  end if;
  if v_committee.payout_order_method <> 'member_choice' then
    raise exception using errcode = 'P0001', message = 'order_method_mismatch';
  end if;
  if p_turn is not null and exists (
    select 1 from public.committee_members m
    where m.committee_id = p_committee_id and m.turn_number = p_turn and m.id <> v_member_id
  ) then
    raise exception using errcode = 'P0001', message = 'turn_taken';
  end if;
  update public.committee_members m set turn_number = p_turn where m.id = v_member_id;
end;
$$;

-------------------------------------------------------------------------------
-- Random draw. Only the draw-payout-order Edge Function (service role) may call this:
-- it generates the order with crypto.getRandomValues and passes the acting user.
-------------------------------------------------------------------------------
create function public.apply_draw_result(
  p_committee_id uuid,
  p_actor uuid,
  p_member_ids uuid[],
  p_algorithm text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
  v_order jsonb;
  v_draw_id uuid;
begin
  v_committee := private.lock_committee_for_organizer(p_committee_id, p_actor, 'draft');
  if v_committee.payout_order_method <> 'random' then
    raise exception using errcode = 'P0001', message = 'order_method_mismatch';
  end if;
  if (select count(*) from public.committee_members m where m.committee_id = p_committee_id)
     <> v_committee.member_count then
    raise exception using errcode = 'P0001', message = 'members_incomplete';
  end if;
  if not private.is_full_member_set(p_committee_id, p_member_ids) then
    raise exception using errcode = 'P0001', message = 'invalid_order';
  end if;
  if coalesce(btrim(p_algorithm), '') = '' then
    raise exception using errcode = 'P0001', message = 'invalid_order';
  end if;

  -- Attribute the audit entries to the organizer who requested the draw.
  perform set_config('kameti.actor_id', p_actor::text, true);
  v_order := private.write_order(p_committee_id, p_member_ids);

  insert into public.payout_draws (committee_id, performed_by, algorithm, result)
  values (p_committee_id, p_actor, p_algorithm, v_order)
  returning id into v_draw_id;

  perform private.log_activity(p_committee_id, 'order.drawn', 'draw', v_draw_id,
    jsonb_build_object('order', v_order, 'algorithm', p_algorithm,
      'draw_number', (select count(*) from public.payout_draws d where d.committee_id = p_committee_id)));
  return v_order;
end;
$$;

-------------------------------------------------------------------------------
-- Activation: locks members and order, creates every month and every payment.
-------------------------------------------------------------------------------
create function public.activate_committee(p_committee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
begin
  v_committee := private.lock_committee_for_organizer(p_committee_id, auth.uid(), 'draft');

  if (select count(*) from public.committee_members m where m.committee_id = p_committee_id)
     <> v_committee.member_count then
    raise exception using errcode = 'P0001', message = 'members_incomplete';
  end if;
  -- Turns are unique and within 1..member_count (constraints), so N assigned turns = a full order.
  if (select count(*) from public.committee_members m
      where m.committee_id = p_committee_id and m.turn_number is not null) <> v_committee.member_count then
    raise exception using errcode = 'P0001', message = 'order_incomplete';
  end if;
  if v_committee.start_month < private.current_karachi_month() then
    raise exception using errcode = 'P0001', message = 'start_month_in_past';
  end if;

  insert into public.cycles (committee_id, cycle_number, due_date, payout_date, recipient_member_id)
  select p_committee_id, m.turn_number,
         private.cycle_date(v_committee.start_month, m.turn_number, v_committee.due_day),
         private.cycle_date(v_committee.start_month, m.turn_number, v_committee.payout_day),
         m.id
  from public.committee_members m
  where m.committee_id = p_committee_id;

  -- Everyone pays every month, including that month's recipient (pot = amount x members).
  insert into public.payments (committee_id, cycle_id, member_id, amount)
  select p_committee_id, c.id, m.id, v_committee.contribution_amount
  from public.cycles c
  cross join public.committee_members m
  where c.committee_id = p_committee_id and m.committee_id = p_committee_id;

  update public.committees
  set status = 'active', activated_at = now(), order_locked_at = now()
  where id = p_committee_id;
end;
$$;

-------------------------------------------------------------------------------
-- Payouts
-------------------------------------------------------------------------------
create function private.lock_cycle_for_organizer(p_cycle_id uuid)
returns public.cycles
language plpgsql
set search_path = ''
as $$
declare
  v_cycle public.cycles%rowtype;
begin
  select * into v_cycle from public.cycles c where c.id = p_cycle_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  perform private.lock_committee_for_organizer(v_cycle.committee_id, auth.uid(), 'active');
  return v_cycle;
end;
$$;

create function public.complete_payout(p_cycle_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles%rowtype;
begin
  v_cycle := private.lock_cycle_for_organizer(p_cycle_id);
  if v_cycle.payout_status = 'completed' then
    raise exception using errcode = 'P0001', message = 'payout_already_completed';
  end if;
  update public.cycles
  set payout_status = 'completed', payout_completed_at = now(), payout_completed_by = auth.uid(),
      payout_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_cycle_id;
end;
$$;

create function public.revert_payout(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles%rowtype;
begin
  v_cycle := private.lock_cycle_for_organizer(p_cycle_id);
  if v_cycle.payout_status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'payout_not_completed';
  end if;
  update public.cycles
  set payout_status = 'pending', payout_completed_at = null, payout_completed_by = null, payout_note = null
  where id = p_cycle_id;
end;
$$;

-------------------------------------------------------------------------------
-- Changing the order after activation: organizer-only, both months not yet paid out,
-- reason required, logged as one 'order.changed' entry.
-------------------------------------------------------------------------------
create function public.swap_payout_turns(p_cycle_a uuid, p_cycle_b uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.cycles%rowtype;
  v_b public.cycles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    raise exception using errcode = 'P0001', message = 'reason_required';
  end if;
  v_a := private.lock_cycle_for_organizer(p_cycle_a);
  select * into v_b from public.cycles c where c.id = p_cycle_b for update;
  if not found or v_b.committee_id <> v_a.committee_id or v_b.id = v_a.id then
    raise exception using errcode = 'P0001', message = 'invalid_order';
  end if;
  if v_a.payout_status = 'completed' or v_b.payout_status = 'completed' then
    raise exception using errcode = 'P0001', message = 'payout_already_completed';
  end if;

  perform set_config('kameti.bulk_order_change', 'on', true);
  perform set_config('kameti.allow_locked_member_change', 'on', true);
  update public.committee_members set turn_number = null where id = v_a.recipient_member_id;
  update public.committee_members set turn_number = v_a.cycle_number where id = v_b.recipient_member_id;
  update public.committee_members set turn_number = v_b.cycle_number where id = v_a.recipient_member_id;
  update public.cycles set recipient_member_id = v_b.recipient_member_id where id = v_a.id;
  update public.cycles set recipient_member_id = v_a.recipient_member_id where id = v_b.id;
  perform set_config('kameti.allow_locked_member_change', 'off', true);
  perform set_config('kameti.bulk_order_change', 'off', true);

  perform private.log_activity(v_a.committee_id, 'order.changed', 'committee', v_a.committee_id,
    jsonb_build_object(
      'reason', v_reason,
      'swaps', jsonb_build_array(
        jsonb_build_object('cycle_number', v_a.cycle_number, 'from', v_a.recipient_member_id, 'to', v_b.recipient_member_id),
        jsonb_build_object('cycle_number', v_b.cycle_number, 'from', v_b.recipient_member_id, 'to', v_a.recipient_member_id)
      )));
end;
$$;

-------------------------------------------------------------------------------
-- Privileges
-------------------------------------------------------------------------------
revoke execute on function public.set_payout_order(uuid, uuid[]) from public, anon;
revoke execute on function public.assign_turn(uuid, uuid, smallint) from public, anon;
revoke execute on function public.choose_turn(uuid, smallint) from public, anon;
revoke execute on function public.activate_committee(uuid) from public, anon;
revoke execute on function public.complete_payout(uuid, text) from public, anon;
revoke execute on function public.revert_payout(uuid) from public, anon;
revoke execute on function public.swap_payout_turns(uuid, uuid, text) from public, anon;
revoke execute on function public.apply_draw_result(uuid, uuid, uuid[], text) from public, anon, authenticated;

grant execute on function public.set_payout_order(uuid, uuid[]) to authenticated;
grant execute on function public.assign_turn(uuid, uuid, smallint) to authenticated;
grant execute on function public.choose_turn(uuid, smallint) to authenticated;
grant execute on function public.activate_committee(uuid) to authenticated;
grant execute on function public.complete_payout(uuid, text) to authenticated;
grant execute on function public.revert_payout(uuid) to authenticated;
grant execute on function public.swap_payout_turns(uuid, uuid, text) to authenticated;
grant execute on function public.apply_draw_result(uuid, uuid, uuid[], text) to service_role;
