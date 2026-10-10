-- Payment tracking: claims, confirmation, rejection, undo, late job, completion.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '923000000002', now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', '923000000009', now());

-- Active committee: A organizes and is a member, B is a member.
-- Month 1 was due long ago; month 2 is due far in the future.
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'K', 5000, 2, '2020-01-01', 5, 10);
insert into public.committee_members (id, committee_id, display_name, phone, is_organizer, turn_number) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', '+923000000001', true, 1),
  ('1b000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B', '+923000000002', false, 2);
update public.committees set status = 'active', activated_at = now(), order_locked_at = now()
where id = '10000000-0000-0000-0000-000000000001';
insert into public.cycles (id, committee_id, cycle_number, due_date, payout_date, recipient_member_id) values
  ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '2020-01-05', '2020-01-10', '1a000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, '2099-02-05', '2099-02-10', '1b000000-0000-0000-0000-000000000002');
insert into public.payments (id, committee_id, cycle_id, member_id, amount) values
  ('e1a00000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 5000),
  ('e1b00000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 5000),
  ('e2a00000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', 5000),
  ('e2b00000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000002', 5000);

select is((select count(*)::int from cron.job where jobname = 'kameti-mark-late-payments' and schedule = '5 19 * * *'), 1,
  'late job is scheduled nightly at 00:05 Pakistan time');

-------------------------------------------------------------------------------
-- Late job (system)
-------------------------------------------------------------------------------
select is(private.mark_late_payments(), 2, 'two overdue payments marked late');
select results_eq(
  $$select id::text, status::text from public.payments order by id$$,
  $$values ('e1a00000-0000-0000-0000-000000000001', 'late'), ('e1b00000-0000-0000-0000-000000000002', 'late'),
           ('e2a00000-0000-0000-0000-000000000003', 'pending'), ('e2b00000-0000-0000-0000-000000000004', 'pending')$$,
  'only payments past their due date become late');
select is(private.mark_late_payments(), 0, 'running again changes nothing');
select results_eq(
  $$select count(*)::int, bool_and(actor_id is null) from public.activity_log where action = 'payment.marked_late'$$,
  $$values (2, true)$$, 'late marking is logged as the system');

-------------------------------------------------------------------------------
-- Member claims
-------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.claim_payment('e2b00000-0000-0000-0000-000000000004')$$, '42501', null,
  'anon cannot claim');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok($$update public.payments set status = 'paid', paid_at = now()$$, '42501', null,
  'members cannot write payments directly');
select lives_ok($$select public.claim_payment('e2b00000-0000-0000-0000-000000000004', 'jazzcash', '  Sent from my wallet ')$$,
  'member taps "I''ve paid"');
select results_eq(
  $$select status::text, claimed_by, method::text, note from public.payments where id = 'e2b00000-0000-0000-0000-000000000004'$$,
  $$values ('awaiting_confirmation'::text, 'b0000000-0000-0000-0000-00000000000b'::uuid, 'jazzcash'::text, 'Sent from my wallet'::text)$$,
  'claim records who, how and the note');
select throws_ok($$select public.claim_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'payment_already_claimed', 'cannot claim twice');
select throws_ok($$select public.claim_payment('e2a00000-0000-0000-0000-000000000003')$$,
  'P0001', 'not_found', 'cannot claim someone else''s payment');
select throws_ok($$select public.confirm_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'not_organizer', 'members cannot confirm');
select lives_ok($$select public.claim_payment('e1b00000-0000-0000-0000-000000000002')$$,
  'a late payment can be claimed too');

-- Outsider
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.confirm_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'not_found', 'outsiders cannot confirm (and learn nothing)');
select throws_ok($$select public.claim_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'not_found', 'outsiders cannot claim');

-------------------------------------------------------------------------------
-- Organizer
-------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.reject_payment_claim('e1b00000-0000-0000-0000-000000000002', 'Not received')$$,
  'organizer rejects a claim');
select results_eq(
  $$select status::text, claimed_at is null, note from public.payments where id = 'e1b00000-0000-0000-0000-000000000002'$$,
  $$values ('late'::text, true, 'Not received'::text)$$, 'a rejected overdue claim goes back to late');
select throws_ok($$select public.reject_payment_claim('e1b00000-0000-0000-0000-000000000002')$$,
  'P0001', 'payment_not_claimed', 'only claims can be rejected');

select lives_ok($$select public.confirm_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'organizer confirms a claim');
select results_eq(
  $$select status::text, confirmed_by, method::text, claimed_at is not null, paid_at is not null from public.payments where id = 'e2b00000-0000-0000-0000-000000000004'$$,
  $$values ('paid'::text, 'a0000000-0000-0000-0000-00000000000a'::uuid, 'jazzcash'::text, true, true)$$,
  'confirmed payment keeps the claim time and method');
select throws_ok($$select public.confirm_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'payment_already_paid', 'cannot confirm twice');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.claim_payment('e2b00000-0000-0000-0000-000000000004')$$,
  'P0001', 'payment_already_paid', 'cannot claim a paid payment');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.confirm_payment('e2a00000-0000-0000-0000-000000000003', 'cash', 'Paid at the meeting')$$,
  'organizer marks a payment paid directly, with method and note');
select lives_ok($$select public.revert_payment('e2a00000-0000-0000-0000-000000000003')$$,
  'organizer undoes a payment marked by mistake');
select results_eq(
  $$select status::text, paid_at is null, confirmed_by is null from public.payments where id = 'e2a00000-0000-0000-0000-000000000003'$$,
  $$values ('pending'::text, true, true)$$, 'undo returns a not-yet-due payment to pending');
select throws_ok($$select public.revert_payment('e2a00000-0000-0000-0000-000000000003')$$,
  'P0001', 'payment_not_paid', 'only paid payments can be undone');

select results_eq(
  $$select action from public.activity_log where entity_type = 'payment' and action <> 'payment.marked_late' order by id$$,
  $$values ('payment.claimed'), ('payment.claimed'), ('payment.claim_rejected'), ('payment.confirmed'),
           ('payment.confirmed'), ('payment.reverted')$$,
  'every payment change is in the activity log');
select results_eq(
  $$select actor_id from public.activity_log where action = 'payment.claim_rejected'$$,
  $$values ('a0000000-0000-0000-0000-00000000000a'::uuid)$$, 'with the person who did it');

-------------------------------------------------------------------------------
-- Completion: all payouts done and all payments paid
-------------------------------------------------------------------------------
select public.confirm_payment('e1a00000-0000-0000-0000-000000000001');
select public.confirm_payment('e1b00000-0000-0000-0000-000000000002');
select public.confirm_payment('e2a00000-0000-0000-0000-000000000003');
select public.complete_payout('c1000000-0000-0000-0000-000000000001');
select is((select status::text from public.committees where id = '10000000-0000-0000-0000-000000000001'), 'active',
  'not complete while a payout is outstanding');
select public.complete_payout('c2000000-0000-0000-0000-000000000002');
select results_eq(
  $$select status::text, completed_at is not null from public.committees where id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('completed'::text, true)$$, 'completes automatically when everything is paid and paid out');
select isnt_empty($$select 1 from public.activity_log where action = 'committee.completed'$$, 'completion is logged');
select throws_ok($$select public.revert_payment('e2a00000-0000-0000-0000-000000000003')$$,
  'P0001', 'committee_not_active', 'a completed committee is read-only');
select throws_ok($$select public.revert_payout('c2000000-0000-0000-0000-000000000002')$$,
  'P0001', 'committee_not_active', 'payouts of a completed committee are read-only');

-- Members still see the full history afterwards.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.payments), 4, 'members still see all payments after completion');
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is_empty($$select 1 from public.payments$$, 'outsiders see no payments');

-- The nightly job leaves completed committees alone.
reset role;
select set_config('request.jwt.claims', '', true);
select is(private.mark_late_payments(), 0, 'late job ignores completed committees');
select is((select count(*)::int from public.committees where status = 'completed'), 1, 'exactly one completed committee');
select is((select count(*)::int from cron.job where command like '%mark_late_payments%'), 1, 'job is registered once');

select * from finish();
rollback;
