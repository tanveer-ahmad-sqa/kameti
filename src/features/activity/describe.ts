import type { TFunction } from 'i18next';

import en from '@/i18n/locales/en.json';

export type ActivityEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: unknown;
  created_at: string;
};

export type ActivityContext = {
  /** Name for a committee_members.id (or "a member"). */
  memberName: (memberId: string | undefined) => string;
  /** Name for an auth user id; NULL = the system. */
  actorName: (userId: string | null) => string;
  /** Month number for a cycle id. */
  cycleNumber: (cycleId: string | undefined) => number | undefined;
};

type ActionKey = keyof (typeof en)['activity']['actions'];

/** Every action with a sentence in en.json is supported; new actions just need a string. */
function isActionKey(key: string): key is ActionKey {
  return key !== 'unknown' && Object.prototype.hasOwnProperty.call(en.activity.actions, key);
}

function field(payload: unknown, key: string): unknown {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** One human-readable line per activity log entry. Phone numbers are never in the log. */
export function describeActivity(t: TFunction, entry: ActivityEntry, ctx: ActivityContext): string {
  const key = entry.action.replace('.', '_');
  const actor = ctx.actorName(entry.actor_id);
  const payload = entry.payload;

  const memberId =
    entry.entity_type === 'member'
      ? (entry.entity_id ?? undefined)
      : (str(field(payload, 'member_id')) ?? str(field(payload, 'recipient_member_id')));
  const name =
    entry.entity_type === 'member'
      ? (str(field(payload, 'display_name')) ?? ctx.memberName(memberId))
      : ctx.memberName(memberId);
  const cycleNumber = field(payload, 'cycle_number');
  const number =
    typeof cycleNumber === 'number' ? cycleNumber : ctx.cycleNumber(str(field(payload, 'cycle_id')));

  if (!isActionKey(key)) {
    return t('activity.actions.unknown', { actor });
  }
  return t(`activity.actions.${key}`, {
    actor,
    name,
    number: key === 'order_drawn' ? (str(field(payload, 'draw_number')) ?? '') : (number ?? ''),
    reason: str(field(payload, 'reason')) ?? '',
  });
}
