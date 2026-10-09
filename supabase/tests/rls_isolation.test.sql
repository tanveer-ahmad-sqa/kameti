-- Proves that Row Level Security isolates committees:
--  * a non-member can read NOTHING from another committee, in any table
--  * a member can read but not write
--  * organizer writes are limited to draft committees
--  * anon has no access at all
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-------------------------------------------------------------------------------
-- Fixtures (as postgres, RLS bypassed)
-------------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '923000000002', now()),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', '923000000003', now());

-- K1: draft, organizer A, members A + B + an unregistered person.
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'K1 draft', 5000, 5, '2030-01-01', 5, 10);
insert into public.committee_members (committee_id, display_name, phone, is_organizer) values
  ('10000000-0000-0000-0000-000000000001', 'A', '+923000000001', true),
  ('10000000-0000-0000-0000-000000000001', 'B', '+923000000002', false),
  ('10000000-0000-0000-0000-000000000001', 'D', '+923000000009', false);

-- K3: active, organizer A, members A + B, with cycles, payments, a draw, a notification.
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'K3 active', 10000, 2, '2030-01-01', 5, 10);
insert into public.committee_members (id, committee_id, display_name, phone, is_organizer, turn_number) values
  ('3a000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'A', '+923000000001', true, 1),
  ('3b000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'B', '+923000000002', false, 2);
update public.committees set status = 'active', activated_at = now(), order_locked_at = now()
where id = '30000000-0000-0000-0000-000000000003';
insert into public.cycles (id, committee_id, cycle_number, due_date, payout_date, recipient_member_id) values
  ('3c000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 1, '2030-01-05', '2030-01-10', '3a000000-0000-0000-0000-000000000001');
insert into public.payments (committee_id, cycle_id, member_id, amount) values
  ('30000000-0000-0000-0000-000000000003', '3c000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 10000),
  ('30000000-0000-0000-0000-000000000003', '3c000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000002', 10000);
insert into public.payout_draws (committee_id, performed_by, algorithm, result)
values ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'test', '[]');
insert into public.notification_log (user_id, kind, cycle_id, sent_on)
values ('b0000000-0000-0000-0000-00000000000b', 'due_soon', '3c000000-0000-0000-0000-000000000001', '2030-01-02');

-- K2: draft committee owned by the outsider C (C must see only this).
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'K2 outsider', 1000, 3, '2030-01-01', 1, 1);

-------------------------------------------------------------------------------
-- Outsider C: cannot see or touch K1 / K3 in any table
-------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select results_eq($$select id from public.committees$$, $$values ('20000000-0000-0000-0000-000000000002'::uuid)$$,
  'outsider sees only their own committee');
select is_empty($$select 1 from public.committee_members where committee_id in ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003')$$,
  'outsider cannot read other committees'' members');
select is_empty($$select 1 from public.cycles$$, 'outsider cannot read cycles');
select is_empty($$select 1 from public.payments$$, 'outsider cannot read payments');
select is_empty($$select 1 from public.activity_log where committee_id <> '20000000-0000-0000-0000-000000000002'$$,
  'outsider cannot read other committees'' activity log');
select is_empty($$select 1 from public.payout_draws$$, 'outsider cannot read payout draws');
select results_eq($$select id from public.profiles$$, $$values ('c0000000-0000-0000-0000-00000000000c'::uuid)$$,
  'outsider sees only their own profile');
select throws_ok($$select 1 from public.notification_log$$, '42501', null, 'notification_log is server-only');

prepare outsider_update as update public.committees set name = 'hacked' where id = '10000000-0000-0000-0000-000000000001' returning id;
select is_empty('outsider_update', 'outsider cannot update another committee');
prepare outsider_delete as delete from public.committees where id = '10000000-0000-0000-0000-000000000001' returning id;
select is_empty('outsider_delete', 'outsider cannot delete another committee');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'X', '+923000000077')$$,
  '42501', null, 'outsider cannot add members to another committee');
prepare outsider_member_update as update public.committee_members set display_name = 'hacked' where committee_id = '10000000-0000-0000-0000-000000000001' returning id;
select is_empty('outsider_member_update', 'outsider cannot edit another committee''s members');
prepare outsider_member_delete as delete from public.committee_members where committee_id = '10000000-0000-0000-0000-000000000001' returning id;
select is_empty('outsider_member_delete', 'outsider cannot remove another committee''s members');
select throws_ok(
  $$insert into public.activity_log (committee_id, action, entity_type) values ('10000000-0000-0000-0000-000000000001', 'committee.updated', 'committee')$$,
  '42501', null, 'outsider cannot forge activity log entries');
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('c0000000-0000-0000-0000-00000000000c', 'Direct', 1000, 2, '2030-01-01', 1, 1)$$,
  '42501', null, 'committees cannot be inserted directly (RPC only)');

-------------------------------------------------------------------------------
-- Member B: reads K1 and K3, writes nothing
-------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select results_eq($$select count(*)::int from public.committees$$, array[2], 'member sees both committees they belong to');
select results_eq($$select count(*)::int from public.committee_members where committee_id = '10000000-0000-0000-0000-000000000001'$$,
  array[3], 'member sees all members of their committee');
select results_eq($$select count(*)::int from public.cycles$$, array[1], 'member reads cycles');
select results_eq($$select count(*)::int from public.payments$$, array[2], 'member reads payments');
select results_eq($$select count(*)::int from public.payout_draws$$, array[1], 'member reads payout draws');
select isnt_empty($$select 1 from public.activity_log where committee_id = '10000000-0000-0000-0000-000000000001'$$,
  'member reads the activity log');
select is_empty($$select 1 from public.committees where id = '20000000-0000-0000-0000-000000000002'$$,
  'member cannot see an unrelated committee');

prepare member_update_committee as update public.committees set name = 'B was here' where id = '10000000-0000-0000-0000-000000000001' returning id;
select is_empty('member_update_committee', 'member cannot edit the committee');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'X', '+923000000077')$$,
  '42501', null, 'member cannot add members');
prepare member_edit_self as update public.committee_members set display_name = 'Boss' where phone = '+923000000002' returning id;
select is_empty('member_edit_self', 'member cannot edit member rows, even their own');
select throws_ok(
  $$update public.payments set status = 'paid', paid_at = now()$$,
  '42501', null, 'member cannot write payments directly');
select throws_ok(
  $$update public.cycles set payout_status = 'completed', payout_completed_at = now()$$,
  '42501', null, 'member cannot write cycles directly');
select throws_ok(
  $$update public.profiles set phone = '+923009999999' where id = 'b0000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'phone is not client-editable');
prepare member_name as update public.profiles set full_name = 'Bilal' where id = 'b0000000-0000-0000-0000-00000000000b' returning id;
select isnt_empty('member_name', 'user can edit their own name');
prepare member_edit_other_profile as update public.profiles set full_name = 'X' where id = 'a0000000-0000-0000-0000-00000000000a' returning id;
select is_empty('member_edit_other_profile', 'user cannot edit someone else''s profile');

-------------------------------------------------------------------------------
-- Organizer A: writes allowed only while draft
-------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

prepare org_update_draft as update public.committees set name = 'K1 renamed' where id = '10000000-0000-0000-0000-000000000001' returning id;
select isnt_empty('org_update_draft', 'organizer edits a draft committee');
select lives_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'E', '+923000000005')$$,
  'organizer adds a member to a draft committee');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone, user_id) values ('10000000-0000-0000-0000-000000000001', 'F', '+923000000006', 'c0000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'organizer cannot link a member to an account directly');
select throws_ok(
  $$update public.committee_members set is_organizer = true where phone = '+923000000002'$$,
  '42501', null, 'is_organizer is not client-writable');
select throws_ok(
  $$update public.committees set status = 'active' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'status cannot be changed directly (RPC only)');

prepare org_update_active as update public.committees set name = 'K3 renamed' where id = '30000000-0000-0000-0000-000000000003' returning id;
select is_empty('org_update_active', 'organizer cannot edit an active committee directly');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('30000000-0000-0000-0000-000000000003', 'Late', '+923000000008')$$,
  'P0001', 'committee_not_draft', 'organizer cannot add members to an active committee');
prepare org_delete_member_active as delete from public.committee_members where committee_id = '30000000-0000-0000-0000-000000000003' returning id;
select is_empty('org_delete_member_active', 'organizer cannot remove members from an active committee');
prepare org_delete_active as delete from public.committees where id = '30000000-0000-0000-0000-000000000003' returning id;
select is_empty('org_delete_active', 'organizer cannot delete an active committee');
select throws_ok(
  $$update public.activity_log set action = 'committee.updated'$$,
  '42501', null, 'organizer cannot modify the activity log');
select throws_ok(
  $$insert into public.payout_draws (committee_id, algorithm, result) values ('10000000-0000-0000-0000-000000000001', 'fake', '[]')$$,
  '42501', null, 'organizer cannot insert a draw result directly');

-------------------------------------------------------------------------------
-- anon: nothing
-------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select 1 from public.committees$$, '42501', null, 'anon cannot read committees');
select throws_ok($$select 1 from public.committee_members$$, '42501', null, 'anon cannot read members');
select throws_ok($$select 1 from public.payments$$, '42501', null, 'anon cannot read payments');
select throws_ok($$select 1 from public.profiles$$, '42501', null, 'anon cannot read profiles');

-------------------------------------------------------------------------------
-- Verify nothing changed behind RLS' back
-------------------------------------------------------------------------------
reset role;
select results_eq($$select name from public.committees where id = '30000000-0000-0000-0000-000000000003'$$,
  $$values ('K3 active'::text)$$, 'active committee unchanged');

select * from finish();
rollback;
