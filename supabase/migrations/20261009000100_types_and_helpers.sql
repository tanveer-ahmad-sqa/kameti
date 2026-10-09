-- Enums and private helper schema.
-- `private` is NOT exposed through the Data API; functions here are only callable from SQL
-- (RLS policies, triggers, other functions).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.committee_status as enum ('draft', 'active', 'completed');
create type public.payout_order_method as enum ('random', 'manual', 'member_choice');
create type public.payment_status as enum ('pending', 'awaiting_confirmation', 'paid', 'late');
create type public.payment_method as enum ('cash', 'easypaisa', 'jazzcash', 'bank_transfer');
create type public.payout_status as enum ('pending', 'completed');

-- Generic updated_at maintenance.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- The user performing the current action, for audit purposes.
-- A normal API request: the JWT subject. A service-role RPC acting on behalf of a user
-- (e.g. the draw edge function) sets `kameti.actor_id` for the transaction. NULL = system.
create function private.current_actor()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('kameti.actor_id', true), '')::uuid
  );
$$;

-- Returns {"field": {"from": old, "to": new}} for every changed key, ignoring bookkeeping columns.
create function private.jsonb_changes(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('from', old_row -> n.key, 'to', n.value)),
    '{}'::jsonb
  )
  from jsonb_each(new_row) as n
  where n.key not in ('updated_at', 'created_at')
    and (old_row -> n.key) is distinct from n.value;
$$;
