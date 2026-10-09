-- Business-rule triggers. These hold no matter who writes (client, RPC, service role),
-- so the UI and edge functions can never bypass them.
--
-- Error convention: `raise exception using errcode = 'P0001', message = '<code>'` where <code>
-- is a stable snake_case key the app maps to a translated message (src/lib/errors.ts).

-------------------------------------------------------------------------------
-- committees
-------------------------------------------------------------------------------
create function private.committees_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Status may only move forward: draft -> active -> completed.
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'active')
      or (old.status = 'active' and new.status = 'completed')
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_status_transition';
    end if;
  end if;

  -- Financial terms are frozen once the committee leaves draft.
  if old.status <> 'draft' and (
    new.contribution_amount is distinct from old.contribution_amount
    or new.member_count is distinct from old.member_count
    or new.start_month is distinct from old.start_month
    or new.due_day is distinct from old.due_day
    or new.payout_day is distinct from old.payout_day
    or new.payout_order_method is distinct from old.payout_order_method
  ) then
    raise exception using errcode = 'P0001', message = 'committee_locked';
  end if;

  -- The organizer can only be cleared (account deletion), never handed over in v1.
  if new.organizer_id is distinct from old.organizer_id and new.organizer_id is not null then
    raise exception using errcode = 'P0001', message = 'organizer_change_not_allowed';
  end if;

  -- Shrinking the committee must not orphan existing members or turns.
  if new.member_count < old.member_count then
    if (select count(*) from public.committee_members m where m.committee_id = new.id) > new.member_count then
      raise exception using errcode = 'P0001', message = 'member_count_below_members';
    end if;
    if exists (
      select 1 from public.committee_members m
      where m.committee_id = new.id and m.turn_number > new.member_count
    ) then
      raise exception using errcode = 'P0001', message = 'member_count_below_turns';
    end if;
  end if;

  return new;
end;
$$;

create trigger committees_guard_update
before update on public.committees
for each row execute function private.committees_guard_update();

create function private.committees_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'committee_not_draft';
  end if;
  return old;
end;
$$;

create trigger committees_guard_delete
before delete on public.committees
for each row execute function private.committees_guard_delete();

-------------------------------------------------------------------------------
-- committee_members
-------------------------------------------------------------------------------
-- SECURITY DEFINER: needs to read profiles (to link accounts) beyond the caller's RLS view.
create function private.committee_members_guard_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_committee public.committees%rowtype;
  v_count integer;
  v_locked_change_allowed boolean := coalesce(current_setting('kameti.allow_locked_member_change', true), '') = 'on';
begin
  -- Lock the committee row so concurrent inserts can't exceed member_count.
  select * into v_committee from public.committees c where c.id = new.committee_id for update;

  if tg_op = 'UPDATE' and new.committee_id <> old.committee_id then
    raise exception using errcode = 'P0001', message = 'member_committee_immutable';
  end if;

  if v_committee.status <> 'draft' then
    if tg_op = 'INSERT' then
      raise exception using errcode = 'P0001', message = 'committee_not_draft';
    end if;
    -- After activation only these changes are allowed:
    --  * account linking (user_id only)
    --  * becoming a former user (account deletion)
    --  * turn changes inside a logged organizer action that sets the bypass flag
    if not (
      (new.display_name = old.display_name
        and new.phone is not distinct from old.phone
        and new.is_organizer = old.is_organizer
        and new.is_former_user = old.is_former_user
        and (new.turn_number is not distinct from old.turn_number or v_locked_change_allowed))
      or (new.is_former_user and not old.is_former_user
        and new.phone is null and new.user_id is null
        and new.turn_number is not distinct from old.turn_number)
    ) then
      raise exception using errcode = 'P0001', message = 'committee_not_draft';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.committee_members m where m.committee_id = new.committee_id;
    if v_count >= v_committee.member_count then
      raise exception using errcode = 'P0001', message = 'committee_full';
    end if;
  end if;

  if new.turn_number is not null and new.turn_number > v_committee.member_count then
    raise exception using errcode = 'P0001', message = 'turn_out_of_range';
  end if;

  -- Link to an existing account by phone. Clients cannot set user_id themselves
  -- (no column privilege), so this is the only way a membership gets linked.
  if new.is_former_user then
    new.user_id := null;
  elsif tg_op = 'INSERT' or new.phone is distinct from old.phone then
    select p.id into new.user_id from public.profiles p where p.phone = new.phone;
  end if;

  return new;
end;
$$;

create trigger committee_members_guard_write
before insert or update on public.committee_members
for each row execute function private.committee_members_guard_write();

create function private.committee_members_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.committee_status;
begin
  select c.status into v_status from public.committees c where c.id = old.committee_id;
  -- Not found = the committee itself is being deleted (cascade), which is allowed.
  if found and v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'committee_not_draft';
  end if;
  return old;
end;
$$;

create trigger committee_members_guard_delete
before delete on public.committee_members
for each row execute function private.committee_members_guard_delete();
