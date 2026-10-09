-- The activity log and draw history are append-only, even for the service role / postgres.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '923000000001', now());

-- Actions performed "as" the organizer via the request JWT.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'K1', 5000, 2, '2030-01-01', 5, 10);
insert into public.committee_members (id, committee_id, display_name, phone, is_organizer, turn_number) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', '+923000000001', true, 1),
  ('1b000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B', '+923000000002', false, 2);
update public.committees set name = 'K1 renamed' where id = '10000000-0000-0000-0000-000000000001';

select results_eq(
  $$select action from public.activity_log where committee_id = '10000000-0000-0000-0000-000000000001' order by id$$,
  $$values ('committee.created'), ('member.added'), ('member.added'), ('committee.updated')$$,
  'creating and editing are logged in order');
select is(
  (select actor_id from public.activity_log where action = 'committee.created' and committee_id = '10000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'the actor is recorded');
select is(
  (select payload -> 'changes' -> 'name' ->> 'to' from public.activity_log where action = 'committee.updated' and committee_id = '10000000-0000-0000-0000-000000000001'),
  'K1 renamed', 'updates record what changed');
select is_empty(
  $$select 1 from public.activity_log where committee_id = '10000000-0000-0000-0000-000000000001' and payload::text like '%923000000002%'$$,
  'phone numbers are never written to the log');

update public.committees set status = 'active', activated_at = now(), order_locked_at = now()
where id = '10000000-0000-0000-0000-000000000001';
insert into public.cycles (id, committee_id, cycle_number, due_date, payout_date, recipient_member_id) values
  ('1c000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '2030-01-05', '2030-01-10', '1a000000-0000-0000-0000-000000000001');
insert into public.payments (id, committee_id, cycle_id, member_id, amount) values
  ('1d000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 5000);
update public.payments set status = 'awaiting_confirmation', claimed_at = now() where id = '1d000000-0000-0000-0000-000000000001';
update public.payments set status = 'paid', paid_at = now(), method = 'easypaisa' where id = '1d000000-0000-0000-0000-000000000001';
update public.cycles set payout_status = 'completed', payout_completed_at = now() where id = '1c000000-0000-0000-0000-000000000001';

select isnt_empty($$select 1 from public.activity_log where action = 'committee.activated'$$, 'activation is logged');
select isnt_empty($$select 1 from public.activity_log where action = 'payment.claimed'$$, 'payment claim is logged');
select isnt_empty($$select 1 from public.activity_log where action = 'payment.confirmed' and payload ->> 'method' = 'easypaisa'$$,
  'payment confirmation is logged with method');
select isnt_empty($$select 1 from public.activity_log where action = 'payout.completed'$$, 'payout completion is logged');

-- Tamper attempts, as postgres (the most privileged role).
insert into public.payout_draws (committee_id, performed_by, algorithm, result)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'test', '[]');

select throws_ok($$update public.activity_log set action = 'committee.updated'$$,
  'P0001', 'audit_log_immutable', 'activity log rows cannot be updated');
select throws_ok($$delete from public.activity_log$$,
  'P0001', 'audit_log_immutable', 'activity log rows cannot be deleted');
select throws_ok($$truncate public.activity_log cascade$$,
  'P0001', 'audit_log_immutable', 'activity log cannot be truncated');
select throws_ok($$update public.payout_draws set result = '[{"member_id":"x"}]'$$,
  'P0001', 'audit_log_immutable', 'draw results cannot be changed');
select throws_ok($$delete from public.payout_draws$$,
  'P0001', 'audit_log_immutable', 'draw results cannot be deleted');

-- Deleting a DRAFT committee cascades cleanly, including its log.
insert into public.committees (id, organizer_id, name, contribution_amount, member_count, start_month, due_day, payout_day)
values ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'Draft', 5000, 2, '2030-01-01', 5, 10);
insert into public.committee_members (committee_id, display_name, phone) values
  ('20000000-0000-0000-0000-000000000002', 'B', '+923000000002');
insert into public.payout_draws (committee_id, algorithm, result) values ('20000000-0000-0000-0000-000000000002', 'test', '[]');

select lives_ok($$delete from public.committees where id = '20000000-0000-0000-0000-000000000002'$$,
  'a draft committee can be deleted with its members, log and draws');
select is_empty($$select 1 from public.activity_log where committee_id = '20000000-0000-0000-0000-000000000002'$$,
  'its log is gone with it');
select isnt_empty($$select 1 from public.activity_log where committee_id = '10000000-0000-0000-0000-000000000001'$$,
  'other committees'' logs are untouched');

select * from finish();
rollback;
