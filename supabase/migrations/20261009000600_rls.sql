-- Row Level Security and privileges.
--
-- Model: clients can READ everything for committees they belong to (as organizer or member).
-- Clients can WRITE directly only where RLS is enough (own profile, draft committee setup).
-- Every other write goes through SECURITY DEFINER RPCs / edge functions that validate and log.

-------------------------------------------------------------------------------
-- Default privileges: nothing new is exposed to API roles unless granted explicitly.
-------------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema private from public;

-------------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER to avoid recursive RLS on committee_members).
-------------------------------------------------------------------------------
create function private.is_committee_participant(p_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.committees c
      where c.id = p_committee_id and c.organizer_id = (select auth.uid())
    )
    or exists (
      select 1 from public.committee_members m
      where m.committee_id = p_committee_id and m.user_id = (select auth.uid())
    );
$$;

create function private.is_committee_organizer(p_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.committees c
    where c.id = p_committee_id and c.organizer_id = (select auth.uid())
  );
$$;

create function private.is_draft_organizer(p_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.committees c
    where c.id = p_committee_id
      and c.organizer_id = (select auth.uid())
      and c.status = 'draft'
  );
$$;

grant execute on function private.is_committee_participant(uuid) to authenticated;
grant execute on function private.is_committee_organizer(uuid) to authenticated;
grant execute on function private.is_draft_organizer(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Enable RLS everywhere.
-------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.cycles enable row level security;
alter table public.payments enable row level security;
alter table public.activity_log enable row level security;
alter table public.payout_draws enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_log enable row level security;

-------------------------------------------------------------------------------
-- profiles: a user sees and edits only their own profile. Phone is never client-editable.
-------------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, reminders_enabled, locale) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-------------------------------------------------------------------------------
-- committees: participants read; the organizer edits/deletes only while draft.
-- Creation and status changes happen through RPCs.
-------------------------------------------------------------------------------
grant select, delete on public.committees to authenticated;
grant update (name, description, contribution_amount, member_count, start_month, due_day, payout_day, payout_order_method)
  on public.committees to authenticated;

create policy committees_select_participant on public.committees
  for select to authenticated
  using (private.is_committee_participant(id));

create policy committees_update_draft_organizer on public.committees
  for update to authenticated
  using (organizer_id = (select auth.uid()) and status = 'draft')
  with check (organizer_id = (select auth.uid()) and status = 'draft');

create policy committees_delete_draft_organizer on public.committees
  for delete to authenticated
  using (organizer_id = (select auth.uid()) and status = 'draft');

-------------------------------------------------------------------------------
-- committee_members: participants read; the organizer adds/edits/removes while draft.
-- user_id and is_organizer are never client-writable.
-------------------------------------------------------------------------------
grant select, delete on public.committee_members to authenticated;
grant insert (committee_id, display_name, phone, turn_number) on public.committee_members to authenticated;
grant update (display_name, phone, turn_number) on public.committee_members to authenticated;

create policy committee_members_select_participant on public.committee_members
  for select to authenticated
  using (private.is_committee_participant(committee_id));

create policy committee_members_insert_draft_organizer on public.committee_members
  for insert to authenticated
  with check (private.is_draft_organizer(committee_id));

create policy committee_members_update_draft_organizer on public.committee_members
  for update to authenticated
  using (private.is_draft_organizer(committee_id))
  with check (private.is_draft_organizer(committee_id));

create policy committee_members_delete_draft_organizer on public.committee_members
  for delete to authenticated
  using (private.is_draft_organizer(committee_id));

-------------------------------------------------------------------------------
-- Read-only for participants (all writes via RPCs / triggers).
-------------------------------------------------------------------------------
grant select on public.cycles, public.payments, public.activity_log, public.payout_draws to authenticated;

create policy cycles_select_participant on public.cycles
  for select to authenticated
  using (private.is_committee_participant(committee_id));

create policy payments_select_participant on public.payments
  for select to authenticated
  using (private.is_committee_participant(committee_id));

create policy activity_log_select_participant on public.activity_log
  for select to authenticated
  using (private.is_committee_participant(committee_id));

create policy payout_draws_select_participant on public.payout_draws
  for select to authenticated
  using (private.is_committee_participant(committee_id));

-------------------------------------------------------------------------------
-- push_tokens: own rows only. Registration goes through an RPC (Phase 5) so a token
-- can move between accounts on a shared device.
-------------------------------------------------------------------------------
grant select, delete on public.push_tokens to authenticated;

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notification_log: RLS enabled, no policies, no grants => server-only.
