-- LOCAL DEVELOPMENT SEED (runs on `supabase db reset`). Never run against production.
--
-- Test phones (OTP 123456, see config.toml [auth.sms.test_otp]):
--   +92 300 1111111  Ayesha  - organizer of "Office Kameti" (draft), already registered
--   +92 300 2222222  Bilal   - member of "Office Kameti", NOT registered yet:
--                              sign in with this number to see auto-linking
--   +92 300 3333333  Sana    - member of "Office Kameti", NOT registered yet
--   +92 300 4444444  (none)  - an outsider; sees no committees

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', '923001111111', now(), now(), now(),
  '{"provider":"phone","providers":["phone"]}', '{}'
);

update public.profiles set full_name = 'Ayesha' where id = '11111111-1111-1111-1111-111111111111';

-- Act as Ayesha so the activity log records her as the actor.
select set_config('kameti.actor_id', '11111111-1111-1111-1111-111111111111', true);

insert into public.committees (
  id, organizer_id, name, description, contribution_amount, member_count,
  start_month, due_day, payout_day, payout_order_method
)
values (
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Office Kameti', 'Monthly committee with the office team', 10000, 4,
  date_trunc('month', (now() at time zone 'Asia/Karachi') + interval '1 month')::date,
  5, 10, 'random'
);

insert into public.committee_members (committee_id, display_name, phone, is_organizer)
values
  ('cccccccc-0000-0000-0000-000000000001', 'Ayesha', '+923001111111', true),
  ('cccccccc-0000-0000-0000-000000000001', 'Bilal', '+923002222222', false),
  ('cccccccc-0000-0000-0000-000000000001', 'Sana', '+923003333333', false);
