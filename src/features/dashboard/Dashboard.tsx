import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, ProgressBar } from '@/components/ui';
import type { Committee } from '@/features/committees/api';
import type { Member } from '@/features/members/api';
import type { Payment } from '@/features/payments/api';
import { STATUS_TONE } from '@/features/payments/PaymentDisplay';
import {
  currentCycle,
  effectiveStatus,
  monthSummary,
  overallProgress,
  paymentStreak,
} from '@/features/payments/stats';
import type { Cycle } from '@/features/payout/api';
import {
  addCalendarMonths,
  formatCalendarDate,
  formatMonth,
  formatTimestamp,
  todayInKarachi,
} from '@/lib/dates';
import { spacing } from '@/theme/tokens';
import { formatPKR, potAmount } from '@shared/money';

export type DashboardProps = {
  committee: Committee;
  members: Member[];
  cycles: Cycle[];
  payments: Payment[];
  userId: string | null;
};

/** Started committees: organizer overview and/or the member's own view. */
export function Dashboard(props: DashboardProps) {
  const { t } = useTranslation();
  const { committee, members, userId } = props;
  const isOrganizer = committee.organizer_id === userId;
  const me = members.find((m) => m.user_id === userId);

  return (
    <View style={styles.stack}>
      {committee.status === 'completed' ? (
        <Card>
          <AppText variant="bodyStrong" tone="success">
            {t('dashboard.completed')}
          </AppText>
        </Card>
      ) : null}
      {me ? <MemberDashboard {...props} me={me} /> : null}
      {isOrganizer ? <OrganizerDashboard {...props} /> : null}
    </View>
  );
}

function monthOf(committee: Committee, cycle: Cycle) {
  return addCalendarMonths(committee.start_month, cycle.cycle_number - 1);
}

function OrganizerDashboard({ committee, members, cycles, payments }: DashboardProps) {
  const { t } = useTranslation();
  const today = todayInKarachi();
  const cycle = currentCycle(cycles, today);
  if (!cycle) return null;

  const summary = monthSummary(payments, cycle.id);
  const progress = overallProgress(payments, cycles);
  const names = new Map(
    members.map((m) => [m.id, m.is_former_user ? t('members.formerName') : m.display_name]),
  );
  const nextPayout = [...cycles]
    .sort((a, b) => a.cycle_number - b.cycle_number)
    .find((c) => c.payout_status === 'pending');
  const unpaid = payments
    .filter((p) => p.cycle_id === cycle.id && p.status !== 'paid')
    .map((p) => ({
      payment: p,
      name: names.get(p.member_id) ?? t('members.formerName'),
      status: effectiveStatus(p.status, cycle.due_date, today),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const percent =
    progress.payoutsTotal > 0 ? Math.round((progress.payoutsDone / progress.payoutsTotal) * 100) : 0;

  return (
    <>
      <Card testID="dashboard-month">
        <AppText variant="caption" tone="muted">
          {t('dashboard.thisMonth', { month: formatMonth(monthOf(committee, cycle)) })}
        </AppText>
        <AppText variant="heading">
          {t('payments.collected', {
            collected: formatPKR(summary.collected),
            expected: formatPKR(summary.expected),
          })}
        </AppText>
        <ProgressBar
          value={summary.collected}
          max={summary.expected}
          label={t('payments.paidCount', { paid: summary.paidCount, total: summary.total })}
        />
        <AppText tone="muted">
          {t('dashboard.pendingLabel')}: {formatPKR(summary.outstanding)}
        </AppText>
        {summary.awaitingCount > 0 ? (
          <AppText tone="warning" variant="bodyStrong">
            {t('payments.awaiting', { count: summary.awaitingCount })}
          </AppText>
        ) : null}

        <AppText variant="bodyStrong" style={styles.sectionTitle}>
          {t('dashboard.unpaidTitle')}
        </AppText>
        {unpaid.length === 0 ? (
          <AppText tone="success">{t('dashboard.allPaid')}</AppText>
        ) : (
          unpaid.map((row) => (
            <View key={row.payment.id} style={styles.row}>
              <AppText style={styles.flex}>{row.name}</AppText>
              <Badge label={t(`paymentStatus.${row.status}`)} tone={STATUS_TONE[row.status]} />
            </View>
          ))
        )}
        <Button
          testID="dashboard-payments"
          variant="secondary"
          label={t('dashboard.viewPayments')}
          onPress={() => router.push(`/committee/${committee.id}/payments?cycle=${cycle.id}`)}
        />
      </Card>

      <Card testID="dashboard-next-payout">
        <AppText variant="caption" tone="muted">
          {t('dashboard.nextPayout')}
        </AppText>
        <AppText variant="bodyStrong">
          {nextPayout
            ? t('dashboard.nextPayoutValue', {
                name: names.get(nextPayout.recipient_member_id) ?? t('members.formerName'),
                date: formatCalendarDate(nextPayout.payout_date),
              })
            : t('dashboard.allPaidOut')}
        </AppText>
        {nextPayout ? (
          <AppText tone="muted">
            {formatPKR(potAmount(committee.contribution_amount, committee.member_count))}
          </AppText>
        ) : null}
      </Card>

      <Card testID="dashboard-progress">
        <AppText variant="caption" tone="muted">
          {t('dashboard.progress')}
        </AppText>
        <ProgressBar
          value={progress.payoutsDone}
          max={progress.payoutsTotal}
          label={t('dashboard.progressA11y', { percent })}
        />
        <AppText>
          {t('dashboard.progressPayouts', { done: progress.payoutsDone, total: progress.payoutsTotal })}
        </AppText>
        <AppText tone="muted">
          {t('dashboard.progressPayments', { paid: progress.paymentsPaid, total: progress.paymentsTotal })}
        </AppText>
      </Card>
    </>
  );
}

function MemberDashboard({ committee, cycles, payments, me }: DashboardProps & { me: Member }) {
  const { t } = useTranslation();
  const today = todayInKarachi();
  const cycle = currentCycle(cycles, today);
  const myPayment = cycle
    ? payments.find((p) => p.cycle_id === cycle.id && p.member_id === me.id)
    : undefined;
  const status = myPayment && cycle ? effectiveStatus(myPayment.status, cycle.due_date, today) : undefined;
  const myCycle = cycles.find((c) => c.recipient_member_id === me.id);
  const streak = paymentStreak(me.id, payments, cycles, today);
  const canClaim = committee.status === 'active' && (status === 'pending' || status === 'late');

  return (
    <>
      {cycle && myPayment && status ? (
        <Card testID="dashboard-my-payment">
          <AppText variant="caption" tone="muted">
            {t('dashboard.amountDue')} · {formatMonth(monthOf(committee, cycle))}
          </AppText>
          <View style={styles.row}>
            <AppText variant="title" style={styles.flex}>
              {formatPKR(myPayment.amount)}
            </AppText>
            <Badge label={t(`paymentStatus.${status}`)} tone={STATUS_TONE[status]} />
          </View>
          <AppText tone={status === 'late' ? 'danger' : 'muted'}>
            {t('dashboard.dueDate', { date: formatCalendarDate(cycle.due_date) })}
          </AppText>
          {canClaim ? (
            <Button
              testID="dashboard-claim"
              label={t('payments.iPaid')}
              onPress={() => router.push(`/committee/${committee.id}/payment/${myPayment.id}?mode=claim`)}
            />
          ) : null}
        </Card>
      ) : null}

      {myCycle ? (
        <Card testID="dashboard-my-payout">
          <AppText variant="caption" tone="muted">
            {t('dashboard.myPayout')}
          </AppText>
          <AppText variant="bodyStrong" tone="warning">
            {t('dashboard.myPayoutValue', {
              month: formatMonth(monthOf(committee, myCycle)),
              amount: formatPKR(potAmount(committee.contribution_amount, committee.member_count)),
            })}
          </AppText>
          {myCycle.payout_status === 'completed' && myCycle.payout_completed_at ? (
            <AppText tone="success">
              {t('dashboard.myPayoutDone', { date: formatTimestamp(myCycle.payout_completed_at) })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Card testID="dashboard-streak">
        <AppText variant="caption" tone="muted">
          {t('dashboard.streak')}
        </AppText>
        <AppText variant="bodyStrong">
          {streak > 0 ? t('dashboard.streak', { count: streak }) : t('dashboard.streakZero')}
        </AppText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  flex: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: spacing.sm,
  },
});
