-- create_committee and set_organizer_membership.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '923000000002', now()),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', '923000000003', now());
update public.profiles set full_name = 'Ayesha' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set full_name = 'Bilal' where id = 'b0000000-0000-0000-0000-00000000000b';
-- c has no name yet (profile setup not finished).

-------------------------------------------------------------------------------
-- anon cannot call RPCs
-------------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.create_committee('X', 1000, 2::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  '42501', null, 'anon cannot create committees');
reset role;

-------------------------------------------------------------------------------
-- create_committee as Ayesha
-------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

create temporary table created (id uuid) on commit drop;
grant all on created to authenticated;
insert into created
select public.create_committee('  Family BC  ', 10000, 5::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true, '  ');

select results_eq(
  $$select name, organizer_id, status::text, description from public.committees where id = (select id from created)$$,
  $$values ('Family BC'::text, 'a0000000-0000-0000-0000-00000000000a'::uuid, 'draft'::text, null::text)$$,
  'committee is created as a draft owned by the caller, name trimmed, blank description null');
select results_eq(
  $$select display_name, phone, is_organizer, user_id from public.committee_members where committee_id = (select id from created)$$,
  $$values ('Ayesha'::text, '+923000000001'::text, true, 'a0000000-0000-0000-0000-00000000000a'::uuid)$$,
  'organizer member row is created and linked');
select results_eq(
  $$select action from public.activity_log where committee_id = (select id from created) order by id$$,
  $$values ('committee.created'), ('member.added')$$,
  'creation is logged');

select is(
  (select count(*)::int from public.committee_members
   where committee_id = public.create_committee('Solo', 5000, 3::smallint, '2030-01-01', 1::smallint, 1::smallint, 'manual', false)),
  0, 'organizer can choose not to be a member');

select throws_ok(
  $$select public.create_committee('Past', 1000, 2::smallint, '2020-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  'P0001', 'start_month_in_past', 'start month cannot be in the past');
select lives_ok(
  $$select public.create_committee('This month', 1000, 2::smallint, private.current_karachi_month(), 5::smallint, 10::smallint, 'random', true)$$,
  'start month can be the current month');
select throws_ok(
  $$select public.create_committee('Bad', 1000, 2::smallint, '2030-01-01', 10::smallint, 5::smallint, 'random', true)$$,
  '23514', null, 'payout day before due day is rejected');
select throws_ok(
  $$select public.create_committee('Bad', 0, 2::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  '23514', null, 'zero contribution is rejected');
select throws_ok(
  $$select public.create_committee('', 1000, 2::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  '23514', null, 'blank name is rejected');

-- Draft edits cannot move the start into the past.
select throws_ok(
  $$update public.committees set start_month = '2020-01-01' where id = (select id from created)$$,
  'P0001', 'start_month_in_past', 'draft start month cannot be moved into the past');

-------------------------------------------------------------------------------
-- set_organizer_membership
-------------------------------------------------------------------------------
select lives_ok($$select public.set_organizer_membership((select id from created), false)$$, 'organizer can leave membership');
select is((select count(*)::int from public.committee_members where committee_id = (select id from created)), 0,
  'organizer member row removed');
select lives_ok($$select public.set_organizer_membership((select id from created), true)$$, 'organizer can rejoin');
select lives_ok($$select public.set_organizer_membership((select id from created), true)$$, 'rejoining twice is a no-op');
select is((select count(*)::int from public.committee_members where committee_id = (select id from created) and is_organizer), 1,
  'exactly one organizer row');

-- If added by phone as a regular member first, the row is promoted instead of duplicated.
select public.set_organizer_membership((select id from created), false);
insert into public.committee_members (committee_id, display_name, phone)
values ((select id from created), 'Me', '+923000000001');
select public.set_organizer_membership((select id from created), true);
select results_eq(
  $$select count(*)::int, bool_and(is_organizer) from public.committee_members where committee_id = (select id from created)$$,
  $$values (1, true)$$, 'existing row with the organizer''s phone is promoted');

-------------------------------------------------------------------------------
-- Other users
-------------------------------------------------------------------------------
select is(public.committee_organizer_name((select id from created)), 'Ayesha', 'organizer sees their own name');

-- Add Bilal as a member (organizer acting), then check what Bilal can see.
insert into public.committee_members (committee_id, display_name, phone)
values ((select id from created), 'Bilal', '+923000000002');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.committee_organizer_name((select id from created)), 'Ayesha', 'a member sees the organizer''s name');
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.committee_organizer_name((select id from created)), null, 'an outsider gets nothing');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_organizer_membership((select id from created), false)$$,
  'P0001', 'not_organizer', 'non-organizer cannot toggle organizer membership');
select is_empty($$select 1 from public.committees where id = '00000000-0000-0000-0000-000000000000'$$,
  'sanity: unknown committee is invisible');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_committee('X', 1000, 2::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  'P0001', 'profile_incomplete', 'a user must finish their profile first');

-------------------------------------------------------------------------------
-- After activation
-------------------------------------------------------------------------------
reset role;
update public.committees set status = 'active', activated_at = now(), order_locked_at = now()
where id = (select id from created);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_organizer_membership((select id from created), false)$$,
  'P0001', 'committee_not_draft', 'membership is locked once active');

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.create_committee('X', 1000, 2::smallint, '2030-01-01', 5::smallint, 10::smallint, 'random', true)$$,
  'P0001', 'not_authenticated', 'service calls without a user are rejected');

select * from finish();
rollback;
