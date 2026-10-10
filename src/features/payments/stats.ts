import { format } from 'date-fns';

import { toKarachi } from '@/lib/dates';

export type PaymentStatus = 'pending' | 'awaiting_confirmation' | 'paid' | 'late';

export type StatsPayment = {
  id: string;
  cycle_id: string;
  member_id: string;
  amount: number;
  status: PaymentStatus;
  claimed_at: string | null;
  paid_at: string | null;
};

export type StatsCycle = {
  id: string;
  cycle_number: number;
  due_date: string;
  payout_date: string;
  recipient_member_id: string;
  payout_status: 'pending' | 'completed';
};

/**
 * The status to show today. The nightly job flips pending -> late shortly after midnight;
 * this shows "late" immediately once the due date has passed, even before the job runs.
 */
export function effectiveStatus(status: PaymentStatus, dueDate: string, today: string): PaymentStatus {
  return status === 'pending' && dueDate < today ? 'late' : status;
}

/**
 * The month that matters now: this calendar month's cycle, or the next upcoming one,
 * or the last one when the committee has run its course.
 */
export function currentCycle<T extends StatsCycle>(cycles: T[], today: string): T | undefined {
  const sorted = [...cycles].sort((a, b) => a.cycle_number - b.cycle_number);
  const month = today.slice(0, 7);
  return sorted.find((cycle) => cycle.due_date.slice(0, 7) >= month) ?? sorted[sorted.length - 1];
}

export type MonthSummary = {
  expected: number;
  collected: number;
  outstanding: number;
  paidCount: number;
  awaitingCount: number;
  total: number;
  unpaidMemberIds: string[];
};

/** Collected vs pending for one month. Money awaiting confirmation is not counted as collected. */
export function monthSummary(payments: StatsPayment[], cycleId: string): MonthSummary {
  const rows = payments.filter((p) => p.cycle_id === cycleId);
  const paid = rows.filter((p) => p.status === 'paid');
  const expected = rows.reduce((sum, p) => sum + p.amount, 0);
  const collected = paid.reduce((sum, p) => sum + p.amount, 0);
  return {
    expected,
    collected,
    outstanding: expected - collected,
    paidCount: paid.length,
    awaitingCount: rows.filter((p) => p.status === 'awaiting_confirmation').length,
    total: rows.length,
    unpaidMemberIds: rows.filter((p) => p.status !== 'paid').map((p) => p.member_id),
  };
}

/** Calendar day in Pakistan of a timestamp. */
function karachiDay(timestamp: string): string {
  return format(toKarachi(timestamp), 'yyyy-MM-dd');
}

/**
 * When the member paid, for "on time" purposes: the moment they tapped "I've paid" if they
 * claimed it and it was later confirmed, otherwise when the organizer confirmed it.
 */
export function paidOnDay(payment: StatsPayment): string | null {
  if (payment.status !== 'paid') return null;
  const moment = payment.claimed_at ?? payment.paid_at;
  return moment ? karachiDay(moment) : null;
}

/**
 * Consecutive months, counting back from the latest due month, paid on or before the due date.
 * A month that is due today and still unpaid doesn't break the streak (there's still time).
 */
export function paymentStreak(
  memberId: string,
  payments: StatsPayment[],
  cycles: StatsCycle[],
  today: string,
): number {
  const due = cycles.filter((c) => c.due_date <= today).sort((a, b) => b.cycle_number - a.cycle_number);
  let streak = 0;
  for (const [index, cycle] of due.entries()) {
    const payment = payments.find((p) => p.cycle_id === cycle.id && p.member_id === memberId);
    const day = payment ? paidOnDay(payment) : null;
    if (day !== null && day <= cycle.due_date) {
      streak += 1;
      continue;
    }
    if (index === 0 && cycle.due_date === today) continue;
    break;
  }
  return streak;
}

export type OverallProgress = {
  payoutsDone: number;
  payoutsTotal: number;
  paymentsPaid: number;
  paymentsTotal: number;
  collectedTotal: number;
};

export function overallProgress(payments: StatsPayment[], cycles: StatsCycle[]): OverallProgress {
  const paid = payments.filter((p) => p.status === 'paid');
  return {
    payoutsDone: cycles.filter((c) => c.payout_status === 'completed').length,
    payoutsTotal: cycles.length,
    paymentsPaid: paid.length,
    paymentsTotal: payments.length,
    collectedTotal: paid.reduce((sum, p) => sum + p.amount, 0),
  };
}
