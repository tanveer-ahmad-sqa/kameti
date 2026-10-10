-- Payout order, random draw application, activation, payouts and post-activation swaps.
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '923000000002', now()),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', '923000000003', now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', '923000000009', now());
update public.profiles set full_name = 'Ayesha' where id = 'a0000000-0000-0000-0000-00000000000a';

-- Three committees owned by Ayesha (A), one per method; members A (organizer), B, C.
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day, payout_order_method) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Manual', 5000, 3, '2030-01-01', 5, 10, 'manual'),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'Choice', 5000, 3, '2030-01-01', 5, 10, 'member_choice'),
  ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'Random', 5000, 3, '2030-01-01', 28, 28, 'random');
insert into public.committee_members (id, committee_id, display_name, phone, is_organizer) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', '+923000000001', true),
  ('1b000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B', '+923000000002', false),
  ('1c000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'C', '+923000000003', false),
  ('2a000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'A', '+923000000001', true),
  ('2b000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'B', '+923000000002', false),
  ('2c000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'C', '+923000000003', false),
  ('3a000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'A', '+923000000001', true),
  ('3b000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'B', '+923000000002', false);

-------------------------------------------------------------------------------
-- Manual order
-------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select public.activate_committee('10000000-0000-0000-0000-000000000001')$$,
  'P0001', 'order_incomplete', 'cannot activate without an order');
select throws_ok(
  $$select public.set_payout_order('10000000-0000-0000-0000-000000000001',
    array['1a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002']::uuid[])$$,
  'P0001', 'invalid_order', 'order must include every member');
select throws_ok(
  $$select public.set_payout_order('10000000-0000-0000-0000-000000000001',
    array['1a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000003']::uuid[])$$,
  'P0001', 'invalid_order', 'order cannot repeat a member');
select throws_ok(
  $$select public.set_payout_order('10000000-0000-0000-0000-000000000001',
    array['1a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000003']::uuid[])$$,
  'P0001', 'invalid_order', 'order cannot include another committee''s member');
select lives_ok(
  $$select public.set_payout_order('10000000-0000-0000-0000-000000000001',
    array['1c000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002']::uuid[])$$,
  'organizer sets a manual order');
select results_eq(
  $$select display_name, turn_number::int from public.committee_members where committee_id = '10000000-0000-0000-0000-000000000001' order by turn_number$$,
  $$values ('C'::text, 1), ('A', 2), ('B', 3)$$, 'turns follow the given order');
select lives_ok(
  $$select public.set_payout_order('10000000-0000-0000-0000-000000000001',
    array['1a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', '1c000000-0000-0000-0000-000000000003']::uuid[])$$,
  'the order can be rewritten in draft (swaps included)');
select results_eq(
  $$select action from public.activity_log where committee_id = '10000000-0000-0000-0000-000000000001' and action like 'order.%' or (committee_id = '10000000-0000-0000-0000-000000000001' and action = 'member.turn_changed') order by id$$,
  $$values ('order.set'), ('order.set')$$, 'each order change is logged once, not per member');
select throws_ok(
  $$select public.assign_turn('10000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 1::smallint)$$,
  'P0001', 'order_method_mismatch', 'assign_turn is only for member-choice committees');

-------------------------------------------------------------------------------
-- Member choice
-------------------------------------------------------------------------------
select lives_ok(
  $$select public.assign_turn('20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000003', 3::smallint)$$,
  'organizer assigns a turn to a member without the app');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.choose_turn('20000000-0000-0000-0000-000000000002', 3::smallint)$$,
  'P0001', 'turn_taken', 'a member cannot take a turn someone else holds');
select lives_ok($$select public.choose_turn('20000000-0000-0000-0000-000000000002', 1::smallint)$$, 'member picks a free turn');
select lives_ok($$select public.choose_turn('20000000-0000-0000-0000-000000000002', 2::smallint)$$, 'member can move to another free turn');
select is((select turn_number::int from public.committee_members where id = '2b000000-0000-0000-0000-000000000002'), 2,
  'member now holds turn 2');
select throws_ok(
  $$select public.choose_turn('20000000-0000-0000-0000-000000000002', 4::smallint)$$,
  'P0001', 'turn_out_of_range', 'turns beyond the member count are rejected');
select throws_ok(
  $$select public.assign_turn('20000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000002', 1::smallint)$$,
  'P0001', 'not_organizer', 'members cannot assign turns for others');
select throws_ok(
  $$select public.choose_turn('10000000-0000-0000-0000-000000000001', 1::smallint)$$,
  'P0001', 'order_method_mismatch', 'members cannot choose in a manual committee');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.assign_turn('20000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000002', null)$$,
  'organizer can clear any turn');
select lives_ok($$select public.assign_turn('20000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000002', 2::smallint)$$,
  'and reassign it');

-------------------------------------------------------------------------------
-- Random draw (service role only)
-------------------------------------------------------------------------------
select throws_ok(
  $$select public.apply_draw_result('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
    array['3a000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000002']::uuid[], 'test')$$,
  '42501', null, 'users cannot write a draw result themselves');

reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
select throws_ok(
  $$select public.apply_draw_result('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
    array['3a000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000002']::uuid[], 'test')$$,
  'P0001', 'members_incomplete', 'the draw needs every member to be added');
reset role;
insert into public.committee_members (id, committee_id, display_name, phone) values
  ('3c000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'C', '+923000000003');
set local role service_role;
select throws_ok(
  $$select public.apply_draw_result('30000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b',
    array['3a000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000002', '3c000000-0000-0000-0000-000000000003']::uuid[], 'test')$$,
  'P0001', 'not_organizer', 'only the organizer can request a draw');
select lives_ok(
  $$select public.apply_draw_result('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
    array['3b000000-0000-0000-0000-000000000002', '3c000000-0000-0000-0000-000000000003', '3a000000-0000-0000-0000-000000000001']::uuid[], 'test-algorithm')$$,
  'a valid draw is applied');
select lives_ok(
  $$select public.apply_draw_result('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
    array['3c000000-0000-0000-0000-000000000003', '3a000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000002']::uuid[], 'test-algorithm')$$,
  'a re-draw in draft is allowed');
reset role;

select results_eq(
  $$select display_name, turn_number::int from public.committee_members where committee_id = '30000000-0000-0000-0000-000000000003' order by turn_number$$,
  $$values ('C'::text, 1), ('A', 2), ('B', 3)$$, 'the latest draw sets the turns');
select is((select count(*)::int from public.payout_draws where committee_id = '30000000-0000-0000-0000-000000000003'), 2,
  'every draw is kept permanently');
select results_eq(
  $$select performed_by, algorithm, jsonb_array_length(result) from public.payout_draws where committee_id = '30000000-0000-0000-0000-000000000003' order by created_at limit 1$$,
  $$values ('a0000000-0000-0000-0000-00000000000a'::uuid, 'test-algorithm'::text, 3)$$, 'draws record who, how and the result');
select results_eq(
  $$select actor_id, payload ->> 'draw_number' from public.activity_log where committee_id = '30000000-0000-0000-0000-000000000003' and action = 'order.drawn' order by id$$,
  $$values ('a0000000-0000-0000-0000-00000000000a'::uuid, '1'::text), ('a0000000-0000-0000-0000-00000000000a'::uuid, '2'::text)$$,
  'draws are logged as the organizer, numbered');

-- Members can see the draw history.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.payout_draws where committee_id = '30000000-0000-0000-0000-000000000003'), 2,
  'members can see every draw');

-------------------------------------------------------------------------------
-- Activation
-------------------------------------------------------------------------------
select throws_ok($$select public.activate_committee('30000000-0000-0000-0000-000000000003')$$,
  'P0001', 'not_organizer', 'members cannot activate');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.activate_committee('30000000-0000-0000-0000-000000000003')$$, 'organizer activates');

select results_eq(
  $$select status::text, activated_at is not null, order_locked_at is not null from public.committees where id = '30000000-0000-0000-0000-000000000003'$$,
  $$values ('active'::text, true, true)$$, 'committee is active and locked');
select results_eq(
  $$select c.cycle_number::int, c.due_date, c.payout_date, m.display_name
    from public.cycles c join public.committee_members m on m.id = c.recipient_member_id
    where c.committee_id = '30000000-0000-0000-0000-000000000003' order by c.cycle_number$$,
  $$values (1, '2030-01-28'::date, '2030-01-28'::date, 'C'::text),
           (2, '2030-02-28'::date, '2030-02-28'::date, 'A'::text),
           (3, '2030-03-28'::date, '2030-03-28'::date, 'B'::text)$$,
  'one cycle per month with the right dates and recipients (day 28 works in February)');
select results_eq(
  $$select count(*)::int, sum(amount)::int, bool_and(status = 'pending') from public.payments where committee_id = '30000000-0000-0000-0000-000000000003'$$,
  $$values (9, 45000, true)$$, 'every member owes every month, all pending');
select throws_ok($$select public.activate_committee('30000000-0000-0000-0000-000000000003')$$,
  'P0001', 'committee_not_draft', 'cannot activate twice');
select throws_ok(
  $$select public.choose_turn('30000000-0000-0000-0000-000000000003', 1::smallint)$$,
  'P0001', 'committee_not_draft', 'turns cannot be chosen after activation');
prepare direct_turn as update public.committee_members set turn_number = 3 where id = '3c000000-0000-0000-0000-000000000003' returning id;
select is_empty('direct_turn', 'turns cannot be edited directly after activation');

-- Members incomplete / start month in the past
select throws_ok($$select public.activate_committee('20000000-0000-0000-0000-000000000002')$$,
  'P0001', 'order_incomplete', 'member-choice needs every turn filled');
reset role;
update public.committees set start_month = '2020-01-01' where id = '10000000-0000-0000-0000-000000000001'
  and false; -- (trigger forbids moving into the past; simulate an old draft below)
alter table public.committees disable trigger committees_guard_start_month;
update public.committees set start_month = '2020-01-01' where id = '10000000-0000-0000-0000-000000000001';
alter table public.committees enable trigger committees_guard_start_month;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.activate_committee('10000000-0000-0000-0000-000000000001')$$,
  'P0001', 'start_month_in_past', 'a draft whose start month has passed cannot be activated');

-------------------------------------------------------------------------------
-- Payouts
-------------------------------------------------------------------------------
select lives_ok(
  $$select public.complete_payout((select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1), '  Cash at home  ')$$,
  'organizer marks a payout as done');
select results_eq(
  $$select payout_status::text, payout_completed_by, payout_note from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1$$,
  $$values ('completed'::text, 'a0000000-0000-0000-0000-00000000000a'::uuid, 'Cash at home'::text)$$,
  'payout records who, when and the note');
select throws_ok(
  $$select public.complete_payout((select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1))$$,
  'P0001', 'payout_already_completed', 'cannot complete twice');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.complete_payout((select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 2))$$,
  'P0001', 'not_organizer', 'members cannot mark payouts');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$select public.complete_payout('00000000-0000-0000-0000-000000000000')$$,
  'P0001', 'not_found', 'unknown cycle');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$select public.revert_payout((select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1))$$,
  'organizer can undo a payout marked by mistake');
select results_eq(
  $$select action from public.activity_log where committee_id = '30000000-0000-0000-0000-000000000003' and action like 'payout.%' order by id$$,
  $$values ('payout.completed'), ('payout.reverted')$$, 'payout changes are logged');

-------------------------------------------------------------------------------
-- Swaps after activation
-------------------------------------------------------------------------------
select throws_ok(
  $$select public.swap_payout_turns(
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1),
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 3), ' ')$$,
  'P0001', 'reason_required', 'a reason is required');
select lives_ok(
  $$select public.swap_payout_turns(
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1),
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 3),
    'B needs money for a wedding')$$,
  'organizer swaps two months with a reason');
select results_eq(
  $$select c.cycle_number::int, m.display_name, m.turn_number::int
    from public.cycles c join public.committee_members m on m.id = c.recipient_member_id
    where c.committee_id = '30000000-0000-0000-0000-000000000003' order by c.cycle_number$$,
  $$values (1, 'B'::text, 1), (2, 'A'::text, 2), (3, 'C'::text, 3)$$, 'recipients and turns are swapped together');
select results_eq(
  $$select payload ->> 'reason' from public.activity_log where committee_id = '30000000-0000-0000-0000-000000000003' and action = 'order.changed'$$,
  $$values ('B needs money for a wedding'::text)$$, 'the swap is logged once with its reason');
select is_empty(
  $$select 1 from public.activity_log where committee_id = '30000000-0000-0000-0000-000000000003' and action in ('member.turn_changed', 'payout.recipient_changed')$$,
  'no per-row noise in the log');

select public.complete_payout((select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1));
select throws_ok(
  $$select public.swap_payout_turns(
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 1),
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 2),
    'change of plan')$$,
  'P0001', 'payout_already_completed', 'a month that was already paid out cannot be swapped');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.swap_payout_turns(
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 2),
    (select id from public.cycles where committee_id = '30000000-0000-0000-0000-000000000003' and cycle_number = 3),
    'I want it earlier')$$,
  'P0001', 'not_organizer', 'members cannot swap');

-- A real outsider (D is in no committee) sees none of it.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is_empty($$select 1 from public.payout_draws$$, 'outsider sees no draws');
select is_empty($$select 1 from public.cycles$$, 'outsider sees no cycles');
select throws_ok(
  $$select public.complete_payout((select id from public.cycles limit 1))$$,
  'P0001', 'not_found', 'outsider cannot even find a cycle to complete');

select * from finish();
rollback;
