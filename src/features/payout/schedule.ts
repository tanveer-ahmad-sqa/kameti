import { addCalendarMonths } from '@/lib/dates';
import { potAmount } from '@shared/money';

/** Minimal shapes so this stays a pure, testable function. */
export type ScheduleCommittee = {
  status: 'draft' | 'active' | 'completed';
  start_month: string;
  due_day: number;
  payout_day: number;
  contribution_amount: number;
  member_count: number;
};

export type ScheduleMember = {
  id: string;
  display_name: string;
  user_id: string | null;
  is_former_user: boolean;
  turn_number: number | null;
};

export type ScheduleCycle = {
  id: string;
  cycle_number: number;
  due_date: string;
  payout_date: string;
  recipient_member_id: string;
  payout_status: 'pending' | 'completed';
  payout_completed_at: string | null;
};

export type ScheduleRow = {
  /** Present once the committee has started. */
  cycleId: string | null;
  number: number;
  month: string; // yyyy-MM-01
  dueDate: string; // yyyy-MM-dd
  payoutDate: string;
  recipient: ScheduleMember | null;
  amount: number;
  paidOut: boolean;
  paidOutAt: string | null;
  isCurrentMonth: boolean;
  isPast: boolean;
  isMine: boolean;
};

function dayOfMonth(month: string, day: number): string {
  return `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/**
 * One row per month. For started committees, rows come from `cycles`. For drafts, a preview
 * is built from members' current turns (months nobody holds yet have no recipient).
 */
export function buildSchedule(input: {
  committee: ScheduleCommittee;
  members: ScheduleMember[];
  cycles: ScheduleCycle[];
  userId: string | null;
  today: string; // yyyy-MM-dd in Karachi
}): ScheduleRow[] {
  const { committee, members, cycles, userId, today } = input;
  const byId = new Map(members.map((member) => [member.id, member]));
  const byTurn = new Map(
    members.filter((member) => member.turn_number !== null).map((member) => [member.turn_number, member]),
  );
  const amount = potAmount(committee.contribution_amount, committee.member_count);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const useCycles = committee.status !== 'draft' && cycles.length > 0;

  return Array.from({ length: committee.member_count }, (_, index) => {
    const number = index + 1;
    const month = addCalendarMonths(committee.start_month, index);
    const cycle = useCycles ? cycles.find((c) => c.cycle_number === number) : undefined;
    const recipient = cycle ? (byId.get(cycle.recipient_member_id) ?? null) : (byTurn.get(number) ?? null);
    const payoutDate = cycle?.payout_date ?? dayOfMonth(month, committee.payout_day);

    return {
      cycleId: cycle?.id ?? null,
      number,
      month,
      dueDate: cycle?.due_date ?? dayOfMonth(month, committee.due_day),
      payoutDate,
      recipient,
      amount,
      paidOut: cycle?.payout_status === 'completed',
      paidOutAt: cycle?.payout_completed_at ?? null,
      isCurrentMonth: month === currentMonth,
      isPast: payoutDate < today,
      isMine: Boolean(userId && recipient?.user_id === userId),
    };
  });
}
