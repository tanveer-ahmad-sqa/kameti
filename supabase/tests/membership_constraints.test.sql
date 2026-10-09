-- Account linking by verified phone, and schema/business-rule constraints.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now());

insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'K1', 5000, 3, '2030-01-01', 5, 10);
insert into public.committee_members (committee_id, display_name, phone, is_organizer) values
  ('10000000-0000-0000-0000-000000000001', 'A', '+923000000001', true),
  ('10000000-0000-0000-0000-000000000001', 'B', '+923000000002', false);

-------------------------------------------------------------------------------
-- Linking
-------------------------------------------------------------------------------
select is((select user_id from public.committee_members where phone = '+923000000001'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'member added with a registered phone is linked immediately');
select is((select user_id from public.committee_members where phone = '+923000000002'),
  null::uuid, 'member with unregistered phone starts unlinked');

-- OTP sent but not verified: no profile, no link.
insert into auth.users (instance_id, id, aud, role, phone) values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '923000000002');
select is_empty($$select 1 from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b'$$,
  'no profile before the phone is verified');
select is((select user_id from public.committee_members where phone = '+923000000002'),
  null::uuid, 'unverified phone does not claim memberships');

-- OTP verified.
update auth.users set phone_confirmed_at = now() where id = 'b0000000-0000-0000-0000-00000000000b';
select is((select phone from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b'),
  '+923000000002', 'profile created with E.164 phone after verification');
select is((select user_id from public.committee_members where phone = '+923000000002'),
  'b0000000-0000-0000-0000-00000000000b'::uuid, 'verified user is linked to their membership');
select isnt_empty($$select 1 from public.activity_log where action = 'member.joined'$$, 'joining is logged');

-- Changing a member's phone re-links to the matching account (or none).
update public.committee_members set phone = '+923000000044' where phone = '+923000000002';
select is((select user_id from public.committee_members where phone = '+923000000044'),
  null::uuid, 'changing phone to an unregistered number unlinks');
update public.committee_members set phone = '+923000000002' where phone = '+923000000044';

-------------------------------------------------------------------------------
-- Member constraints
-------------------------------------------------------------------------------
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'Dup', '+923000000002')$$,
  '23505', null, 'duplicate phone within a committee is rejected');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'Landline', '+924235555555')$$,
  '23514', null, 'non-mobile Pakistani number is rejected');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', '  ', '+923000000003')$$,
  '23514', null, 'blank display name is rejected');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone, turn_number) values ('10000000-0000-0000-0000-000000000001', 'C', '+923000000003', 4)$$,
  'P0001', 'turn_out_of_range', 'turn beyond member_count is rejected');
select lives_ok(
  $$insert into public.committee_members (committee_id, display_name, phone, turn_number) values ('10000000-0000-0000-0000-000000000001', 'C', '+923000000003', 1)$$,
  'third member fills the committee');
select throws_ok(
  $$insert into public.committee_members (committee_id, display_name, phone) values ('10000000-0000-0000-0000-000000000001', 'D', '+923000000004')$$,
  'P0001', 'committee_full', 'cannot exceed member_count');
select throws_ok(
  $$update public.committee_members set turn_number = 1 where phone = '+923000000001'$$,
  '23505', null, 'two members cannot hold the same turn');
select throws_ok(
  $$update public.committees set member_count = 2 where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001', 'member_count_below_members', 'cannot shrink below the current number of members');

-------------------------------------------------------------------------------
-- Committee constraints
-------------------------------------------------------------------------------
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('a0000000-0000-0000-0000-00000000000a', 'X', 0, 3, '2030-01-01', 5, 10)$$,
  '23514', null, 'contribution must be positive');
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('a0000000-0000-0000-0000-00000000000a', 'X', 1000, 3, '2030-01-01', 29, 29)$$,
  '23514', null, 'due day must be within 1-28');
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('a0000000-0000-0000-0000-00000000000a', 'X', 1000, 3, '2030-01-01', 10, 5)$$,
  '23514', null, 'payout day cannot be before due day');
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('a0000000-0000-0000-0000-00000000000a', 'X', 1000, 3, '2030-01-15', 5, 10)$$,
  '23514', null, 'start_month must be the first of a month');
select throws_ok(
  $$insert into public.committees (organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day) values ('a0000000-0000-0000-0000-00000000000a', 'X', 1000, 1, '2030-01-01', 5, 10)$$,
  '23514', null, 'a committee needs at least 2 members');

-------------------------------------------------------------------------------
-- Locked after activation
-------------------------------------------------------------------------------
update public.committee_members set turn_number = null where committee_id = '10000000-0000-0000-0000-000000000001';
update public.committees set status = 'active', activated_at = now(), order_locked_at = now()
where id = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$update public.committees set status = 'draft' where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001', 'invalid_status_transition', 'status cannot go backwards');
select throws_ok(
  $$update public.committees set contribution_amount = 9999 where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001', 'committee_locked', 'financial terms are frozen once active');
select throws_ok(
  $$update public.committee_members set display_name = 'Renamed' where phone = '+923000000002'$$,
  'P0001', 'committee_not_draft', 'members cannot be edited once active');
select throws_ok(
  $$update public.committee_members set turn_number = 3 where phone = '+923000000002'$$,
  'P0001', 'committee_not_draft', 'turns cannot change once active without a logged organizer action');
select throws_ok(
  $$delete from public.committee_members where phone = '+923000000002'$$,
  'P0001', 'committee_not_draft', 'members cannot be removed once active');
select throws_ok(
  $$delete from public.committees where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001', 'committee_not_draft', 'active committees cannot be deleted');
select lives_ok(
  $$update public.committee_members set is_former_user = true, phone = null, user_id = null where phone = '+923000000002'$$,
  'a member can become a former user (account deletion) while active');

select * from finish();
rollback;
