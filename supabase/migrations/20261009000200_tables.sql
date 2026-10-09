-- Core tables. Money is whole rupees (integer). Timestamps are UTC (timestamptz).
-- Calendar values (due dates, start month) are `date`, interpreted in Asia/Karachi.

-------------------------------------------------------------------------------
-- profiles: one per verified phone user. Created by trigger on phone confirmation.
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- E.164. The app only accepts Pakistani mobiles, but auth may hold any valid number.
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  full_name text check (char_length(btrim(full_name)) between 1 and 60),
  reminders_enabled boolean not null default true,
  locale text not null default 'en' check (locale in ('en', 'ur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- committees
-------------------------------------------------------------------------------
create table public.committees (
  id uuid primary key default gen_random_uuid(),
  -- NULL only after the organizer deleted their account (allowed once completed).
  organizer_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 500),
  contribution_amount integer not null check (contribution_amount between 1 and 10000000),
  member_count smallint not null check (member_count between 2 and 50),
  -- First day of the first month.
  start_month date not null check (extract(day from start_month) = 1),
  due_day smallint not null check (due_day between 1 and 28),
  payout_day smallint not null check (payout_day between 1 and 28),
  payout_order_method public.payout_order_method not null default 'random',
  status public.committee_status not null default 'draft',
  order_locked_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committees_payout_after_due check (payout_day >= due_day),
  constraint committees_organizer_required check (organizer_id is not null or status = 'completed'),
  constraint committees_active_fields check (
    status = 'draft' or (activated_at is not null and order_locked_at is not null)
  ),
  constraint committees_completed_fields check ((status = 'completed') = (completed_at is not null))
);

create index committees_organizer_id_idx on public.committees (organizer_id);

create trigger committees_set_updated_at
before update on public.committees
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- committee_members: people in a committee, with or without an account.
-------------------------------------------------------------------------------
create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  -- Linked automatically when a profile with the same phone exists / signs up.
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  -- Pakistani mobile in E.164. NULL only for a former (deleted) user.
  phone text check (phone ~ '^\+923[0-9]{9}$'),
  is_organizer boolean not null default false,
  is_former_user boolean not null default false,
  turn_number smallint check (turn_number between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_members_phone_required check (phone is not null or is_former_user),
  constraint committee_members_unique_phone unique (committee_id, phone),
  -- Deferrable so a whole order can be rewritten inside one transaction.
  constraint committee_members_unique_turn unique (committee_id, turn_number)
    deferrable initially immediate,
  -- Target for composite FKs that guarantee rows belong to the same committee.
  constraint committee_members_id_committee unique (id, committee_id)
);

create unique index committee_members_one_organizer_idx
  on public.committee_members (committee_id) where is_organizer;
create index committee_members_user_id_idx on public.committee_members (user_id);
create index committee_members_phone_idx on public.committee_members (phone);

create trigger committee_members_set_updated_at
before update on public.committee_members
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- cycles: one row per month, generated on activation.
-------------------------------------------------------------------------------
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  cycle_number smallint not null check (cycle_number between 1 and 50),
  due_date date not null,
  payout_date date not null,
  recipient_member_id uuid not null,
  payout_status public.payout_status not null default 'pending',
  payout_completed_at timestamptz,
  payout_completed_by uuid references public.profiles (id) on delete set null,
  payout_note text check (char_length(payout_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycles_unique_number unique (committee_id, cycle_number),
  constraint cycles_id_committee unique (id, committee_id),
  constraint cycles_payout_after_due check (payout_date >= due_date),
  constraint cycles_payout_completed_fields check (
    (payout_status = 'completed') = (payout_completed_at is not null)
  ),
  constraint cycles_recipient_fk foreign key (recipient_member_id, committee_id)
    references public.committee_members (id, committee_id)
);

create index cycles_recipient_member_id_idx on public.cycles (recipient_member_id);
create index cycles_due_date_idx on public.cycles (due_date);

create trigger cycles_set_updated_at
before update on public.cycles
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- payments: exactly one per member per cycle.
-------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  cycle_id uuid not null,
  member_id uuid not null,
  amount integer not null check (amount > 0),
  status public.payment_status not null default 'pending',
  method public.payment_method,
  note text check (char_length(note) <= 500),
  -- When the member tapped "I've paid".
  claimed_at timestamptz,
  claimed_by uuid references public.profiles (id) on delete set null,
  -- When the organizer confirmed / marked paid.
  paid_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_one_per_member_per_cycle unique (cycle_id, member_id),
  constraint payments_paid_fields check ((status = 'paid') = (paid_at is not null)),
  constraint payments_claim_fields check (status <> 'awaiting_confirmation' or claimed_at is not null),
  constraint payments_cycle_fk foreign key (cycle_id, committee_id)
    references public.cycles (id, committee_id) on delete cascade,
  constraint payments_member_fk foreign key (member_id, committee_id)
    references public.committee_members (id, committee_id) on delete cascade
);

create index payments_committee_status_idx on public.payments (committee_id, status);
create index payments_member_id_idx on public.payments (member_id);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- activity_log: append-only audit trail (enforced by triggers in a later migration).
-- actor_id has no FK on purpose: an FK with ON DELETE SET NULL would require UPDATEs.
-- The UI resolves names via committee_members.user_id and shows "Former user" otherwise.
-------------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  committee_id uuid not null references public.committees (id) on delete cascade,
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null check (entity_type ~ '^[a-z_]+$'),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_committee_created_idx on public.activity_log (committee_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_id);

-------------------------------------------------------------------------------
-- payout_draws: every server-side random draw, append-only.
-------------------------------------------------------------------------------
create table public.payout_draws (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  performed_by uuid,
  algorithm text not null,
  -- [{ "member_id": uuid, "turn_number": int }, ...]
  result jsonb not null check (jsonb_typeof(result) = 'array'),
  created_at timestamptz not null default now()
);

create index payout_draws_committee_idx on public.payout_draws (committee_id, created_at desc);

-------------------------------------------------------------------------------
-- push_tokens: Expo push tokens per device.
-------------------------------------------------------------------------------
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- notification_log: idempotency for scheduled reminders. Server-only.
-------------------------------------------------------------------------------
create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  sent_on date not null,
  created_at timestamptz not null default now(),
  constraint notification_log_once unique (user_id, kind, cycle_id, sent_on)
);

create index notification_log_cycle_id_idx on public.notification_log (cycle_id);
