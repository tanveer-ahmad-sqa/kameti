-- Phase 2: committee creation and organizer membership RPCs, start-month rule.

-- First day of the current month in Pakistan.
create function private.current_karachi_month()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'Asia/Karachi')::date;
$$;

-------------------------------------------------------------------------------
-- Drafts may not be moved to a month that has already started.
-------------------------------------------------------------------------------
create function private.committees_guard_start_month()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'draft'
     and new.start_month is distinct from old.start_month
     and new.start_month < private.current_karachi_month() then
    raise exception using errcode = 'P0001', message = 'start_month_in_past';
  end if;
  return new;
end;
$$;

create trigger committees_guard_start_month
before update on public.committees
for each row execute function private.committees_guard_start_month();

-------------------------------------------------------------------------------
-- create_committee: creates a draft committee owned by the caller and, optionally,
-- the caller's own member row, atomically.
-------------------------------------------------------------------------------
create function public.create_committee(
  p_name text,
  p_contribution_amount integer,
  p_member_count smallint,
  p_start_month date,
  p_due_day smallint,
  p_payout_day smallint,
  p_payout_order_method public.payout_order_method,
  p_include_organizer boolean,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_committee_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user_id;
  if not found or v_profile.full_name is null then
    raise exception using errcode = 'P0001', message = 'profile_incomplete';
  end if;

  if p_start_month < private.current_karachi_month() then
    raise exception using errcode = 'P0001', message = 'start_month_in_past';
  end if;

  if p_include_organizer and v_profile.phone !~ '^\+923[0-9]{9}$' then
    raise exception using errcode = 'P0001', message = 'organizer_phone_not_supported';
  end if;

  insert into public.committees (
    organizer_id, name, description, contribution_amount, member_count,
    start_month, due_day, payout_day, payout_order_method
  )
  values (
    v_user_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_contribution_amount,
    p_member_count, p_start_month, p_due_day, p_payout_day, p_payout_order_method
  )
  returning id into v_committee_id;

  if p_include_organizer then
    insert into public.committee_members (committee_id, display_name, phone, is_organizer)
    values (v_committee_id, v_profile.full_name, v_profile.phone, true);
  end if;

  return v_committee_id;
end;
$$;

revoke execute on function public.create_committee(text, integer, smallint, date, smallint, smallint, public.payout_order_method, boolean, text)
  from public, anon;
grant execute on function public.create_committee(text, integer, smallint, date, smallint, smallint, public.payout_order_method, boolean, text)
  to authenticated;

-------------------------------------------------------------------------------
-- set_organizer_membership: the "I'm also a member" toggle while in draft.
-------------------------------------------------------------------------------
create function public.set_organizer_membership(p_committee_id uuid, p_is_member boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if not private.is_committee_organizer(p_committee_id) then
    raise exception using errcode = 'P0001', message = 'not_organizer';
  end if;
  if not private.is_draft_organizer(p_committee_id) then
    raise exception using errcode = 'P0001', message = 'committee_not_draft';
  end if;

  if not p_is_member then
    delete from public.committee_members m
    where m.committee_id = p_committee_id and m.is_organizer;
    return;
  end if;

  if exists (
    select 1 from public.committee_members m
    where m.committee_id = p_committee_id and m.is_organizer
  ) then
    return;
  end if;

  select * into v_profile from public.profiles p where p.id = v_user_id;
  if v_profile.phone !~ '^\+923[0-9]{9}$' then
    raise exception using errcode = 'P0001', message = 'organizer_phone_not_supported';
  end if;

  -- If the organizer was already added by phone as a regular member, promote that row.
  update public.committee_members m
  set is_organizer = true
  where m.committee_id = p_committee_id and m.phone = v_profile.phone;
  if found then
    return;
  end if;

  insert into public.committee_members (committee_id, display_name, phone, is_organizer)
  values (p_committee_id, coalesce(v_profile.full_name, 'Organizer'), v_profile.phone, true);
end;
$$;

revoke execute on function public.set_organizer_membership(uuid, boolean) from public, anon;
grant execute on function public.set_organizer_membership(uuid, boolean) to authenticated;

-------------------------------------------------------------------------------
-- committee_organizer_name: members can't read other profiles, but should know who
-- runs their committee (even when the organizer isn't a member themselves).
-------------------------------------------------------------------------------
create function public.committee_organizer_name(p_committee_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name
  from public.committees c
  join public.profiles p on p.id = c.organizer_id
  where c.id = p_committee_id
    and private.is_committee_participant(p_committee_id);
$$;

revoke execute on function public.committee_organizer_name(uuid) from public, anon;
grant execute on function public.committee_organizer_name(uuid) to authenticated;
