import type { TFunction } from 'i18next';

import { addCalendarMonths, formatMonth, formatTimestamp } from '@/lib/dates';
import {
  effectiveStatus,
  type PaymentStatus,
  type StatsCycle,
  type StatsPayment,
} from '@/features/payments/stats';
import { formatPKR, potAmount } from '@shared/money';

export type HistoryMember = {
  id: string;
  display_name: string;
  is_former_user: boolean;
};

export type HistoryCycle = StatsCycle & { payout_completed_at: string | null };

export type HistoryPayment = StatsPayment;

export type HistoryFilter = {
  cycleId: string | null;
  memberId: string | null;
};

export type HistoryPaymentRow<P extends HistoryPayment = HistoryPayment> = {
  payment: P;
  memberName: string;
  status: PaymentStatus;
};

export type HistoryMonth<P extends HistoryPayment = HistoryPayment> = {
  cycle: HistoryCycle;
  month: string;
  recipientName: string;
  payments: HistoryPaymentRow<P>[];
};

export function memberDisplayName(member: HistoryMember | undefined, formerUser: string): string {
  if (!member) return formerUser;
  return member.is_former_user ? formerUser : member.display_name;
}

/**
 * Months that have started (due this month or earlier), newest first, with each member's
 * payment. Filters narrow to one month and/or one member.
 */
export function buildHistory<P extends HistoryPayment>(input: {
  startMonth: string;
  members: HistoryMember[];
  cycles: HistoryCycle[];
  payments: P[];
  filter: HistoryFilter;
  today: string;
  formerUser: string;
}): HistoryMonth<P>[] {
  const { startMonth, members, cycles, payments, filter, today, formerUser } = input;
  const names = new Map(members.map((m) => [m.id, memberDisplayName(m, formerUser)]));
  const currentMonth = today.slice(0, 7);

  return [...cycles]
    .filter((cycle) =>
      filter.cycleId ? cycle.id === filter.cycleId : cycle.due_date.slice(0, 7) <= currentMonth,
    )
    .sort((a, b) => b.cycle_number - a.cycle_number)
    .map((cycle) => ({
      cycle,
      month: addCalendarMonths(startMonth, cycle.cycle_number - 1),
      recipientName: names.get(cycle.recipient_member_id) ?? formerUser,
      payments: payments
        .filter((p) => p.cycle_id === cycle.id && (!filter.memberId || p.member_id === filter.memberId))
        .map((payment) => ({
          payment,
          memberName: names.get(payment.member_id) ?? formerUser,
          status: effectiveStatus(payment.status, cycle.due_date, today),
        }))
        .sort((a, b) => a.memberName.localeCompare(b.memberName)),
    }))
    .filter((month) => !filter.memberId || month.payments.length > 0);
}

/** Plain text for WhatsApp: whole committee, or one member's record when filtered by member. */
export function buildShareText(
  t: TFunction,
  input: {
    committee: { name: string; contribution_amount: number; member_count: number };
    months: HistoryMonth[];
    cycles: HistoryCycle[];
    memberName: string | null;
  },
): string {
  const { committee, months, cycles, memberName } = input;
  const lines: string[] = [
    t('history.summary.header', { name: committee.name }),
    t('history.summary.terms', {
      amount: formatPKR(committee.contribution_amount),
      count: committee.member_count,
      pot: formatPKR(potAmount(committee.contribution_amount, committee.member_count)),
    }),
    t('history.summary.progress', {
      done: cycles.filter((c) => c.payout_status === 'completed').length,
      total: cycles.length,
    }),
    '',
  ];

  if (memberName) {
    lines.push(t('history.summary.memberHeader', { name: memberName }));
    for (const month of [...months].reverse()) {
      for (const row of month.payments) {
        const when = row.payment.paid_at ? ` (${formatTimestamp(row.payment.paid_at)})` : '';
        lines.push(
          t('history.summary.memberLine', {
            month: formatMonth(month.month),
            status: `${t(`paymentStatus.${row.status}`)}${when}`,
          }),
        );
      }
    }
  } else {
    for (const month of [...months].reverse()) {
      const payout =
        month.cycle.payout_status === 'completed' && month.cycle.payout_completed_at
          ? t('history.payoutDone', { date: formatTimestamp(month.cycle.payout_completed_at) })
          : t('history.payoutPending');
      lines.push(
        t('history.summary.monthLine', {
          month: formatMonth(month.month),
          name: month.recipientName,
          status: payout,
        }),
      );
      const paid = month.payments.filter((row) => row.status === 'paid');
      lines.push(t('history.summary.paidLine', { count: paid.length, total: month.payments.length }));
      const unpaid = month.payments.filter((row) => row.status !== 'paid').map((row) => row.memberName);
      if (unpaid.length > 0) lines.push(t('history.summary.unpaidLine', { names: unpaid.join(', ') }));
    }
  }

  lines.push('', t('history.summary.footer'));
  return lines.join('\n');
}
