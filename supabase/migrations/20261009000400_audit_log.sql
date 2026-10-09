-- Activity log: written only by triggers / SECURITY DEFINER functions, never by clients.
-- activity_log and payout_draws are append-only: no UPDATE ever, and DELETE only happens as a
-- cascade when a draft committee is deleted.

-------------------------------------------------------------------------------
-- Append-only enforcement
-------------------------------------------------------------------------------
create function private.forbid_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception using errcode = 'P0001', message = 'audit_log_immutable';
  end if;
  -- DELETE: only allowed when the parent committee is gone (cascade from deleting a draft).
  if exists (select 1 from public.committees c where c.id = old.committee_id) then
    raise exception using errcode = 'P0001', message = 'audit_log_immutable';
  end if;
  return old;
end;
$$;

create trigger activity_log_append_only
before update or delete on public.activity_log
for each row execute function private.forbid_audit_mutation();

create trigger payout_draws_append_only
before update or delete on public.payout_draws
for each row execute function private.forbid_audit_mutation();

-- TRUNCATE bypasses row triggers, so block it explicitly.
create function private.forbid_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'audit_log_immutable';
end;
$$;

create trigger activity_log_no_truncate
before truncate on public.activity_log
for each statement execute function private.forbid_truncate();

create trigger payout_draws_no_truncate
before truncate on public.payout_draws
for each statement execute function private.forbid_truncate();

-------------------------------------------------------------------------------
-- Writer
-------------------------------------------------------------------------------
create function private.log_activity(
  p_committee_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip if the committee is being deleted in this statement (cascade).
  if not exists (select 1 from public.committees c where c.id = p_committee_id) then
    return;
  end if;
  insert into public.activity_log (committee_id, actor_id, action, entity_type, entity_id, payload)
  values (p_committee_id, private.current_actor(), p_action, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-------------------------------------------------------------------------------
-- committees
-------------------------------------------------------------------------------
create function private.audit_committees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.id, 'committee.created', 'committee', new.id,
      jsonb_build_object(
        'name', new.name,
        'contribution_amount', new.contribution_amount,
        'member_count', new.member_count,
        'start_month', new.start_month,
        'due_day', new.due_day,
        'payout_day', new.payout_day,
        'payout_order_method', new.payout_order_method
      ));
    return new;
  end if;

  if new.status is distinct from old.status then
    perform private.log_activity(new.id,
      case new.status when 'active' then 'committee.activated' else 'committee.completed' end,
      'committee', new.id, '{}'::jsonb);
    return new;
  end if;

  v_changes := private.jsonb_changes(to_jsonb(old), to_jsonb(new));
  if v_changes <> '{}'::jsonb then
    perform private.log_activity(new.id, 'committee.updated', 'committee', new.id,
      jsonb_build_object('changes', v_changes));
  end if;
  return new;
end;
$$;

create trigger committees_audit
after insert or update on public.committees
for each row execute function private.audit_committees();

-------------------------------------------------------------------------------
-- committee_members (phone numbers are deliberately kept out of the log)
-------------------------------------------------------------------------------
create function private.audit_committee_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.committee_id, 'member.added', 'member', new.id,
      jsonb_build_object('display_name', new.display_name, 'turn_number', new.turn_number));
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.log_activity(old.committee_id, 'member.removed', 'member', old.id,
      jsonb_build_object('display_name', old.display_name));
    return old;
  end if;

  if new.is_former_user and not old.is_former_user then
    perform private.log_activity(new.committee_id, 'member.account_deleted', 'member', new.id, '{}'::jsonb);
    return new;
  end if;

  if new.user_id is not null and old.user_id is null
     and new.phone is not distinct from old.phone then
    perform private.log_activity(new.committee_id, 'member.joined', 'member', new.id,
      jsonb_build_object('display_name', new.display_name));
    return new;
  end if;

  v_changes := private.jsonb_changes(
    to_jsonb(old) - 'phone' - 'user_id',
    to_jsonb(new) - 'phone' - 'user_id'
  );
  if new.phone is distinct from old.phone then
    v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('changed', true));
  end if;
  if v_changes = '{}'::jsonb then
    return new;
  end if;

  perform private.log_activity(new.committee_id,
    case when v_changes ? 'turn_number' and (v_changes - 'turn_number') = '{}'::jsonb
      then 'member.turn_changed' else 'member.updated' end,
    'member', new.id,
    jsonb_build_object('display_name', new.display_name, 'changes', v_changes));
  return new;
end;
$$;

create trigger committee_members_audit
after insert or update or delete on public.committee_members
for each row execute function private.audit_committee_members();

-------------------------------------------------------------------------------
-- cycles (payout state)
-------------------------------------------------------------------------------
create function private.audit_cycles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Cycle rows are created in bulk on activation; that is logged once as committee.activated.
  if new.payout_status is distinct from old.payout_status then
    perform private.log_activity(new.committee_id,
      case new.payout_status when 'completed' then 'payout.completed' else 'payout.reverted' end,
      'cycle', new.id,
      jsonb_build_object('cycle_number', new.cycle_number, 'recipient_member_id', new.recipient_member_id,
        'note', new.payout_note));
  elsif new.recipient_member_id is distinct from old.recipient_member_id then
    perform private.log_activity(new.committee_id, 'payout.recipient_changed', 'cycle', new.id,
      jsonb_build_object('cycle_number', new.cycle_number,
        'from', old.recipient_member_id, 'to', new.recipient_member_id));
  end if;
  return new;
end;
$$;

create trigger cycles_audit
after update on public.cycles
for each row execute function private.audit_cycles();

-------------------------------------------------------------------------------
-- payments
-------------------------------------------------------------------------------
create function private.audit_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if new.status is not distinct from old.status
     and new.method is not distinct from old.method
     and new.note is not distinct from old.note then
    return new;
  end if;

  v_action := case
    when new.status = old.status then 'payment.updated'
    when new.status = 'awaiting_confirmation' then 'payment.claimed'
    when new.status = 'paid' then 'payment.confirmed'
    when new.status = 'late' and old.status = 'pending' then 'payment.marked_late'
    when old.status = 'paid' then 'payment.reverted'
    when old.status = 'awaiting_confirmation' then 'payment.claim_rejected'
    else 'payment.updated'
  end;

  perform private.log_activity(new.committee_id, v_action, 'payment', new.id,
    jsonb_build_object(
      'member_id', new.member_id,
      'cycle_id', new.cycle_id,
      'from', old.status,
      'to', new.status,
      'method', new.method,
      'note', new.note
    ));
  return new;
end;
$$;

create trigger payments_audit
after update on public.payments
for each row execute function private.audit_payments();
