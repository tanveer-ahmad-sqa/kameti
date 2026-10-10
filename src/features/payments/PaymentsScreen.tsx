import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
} from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import type { Committee } from '@/features/committees/api';
import { useCommitteeData } from '@/features/committees/useCommitteeData';
import type { Member } from '@/features/members/api';
import type { Cycle } from '@/features/payout/api';
import { confirm } from '@/lib/confirm';
import { addCalendarMonths, formatCalendarDate, formatMonth, todayInKarachi } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';
import { formatPKR } from '@shared/money';

import { useRejectClaim, useRevertPayment, type Payment } from './api';
import { PaymentDetailsLine, STATUS_TONE } from './PaymentDisplay';
import { currentCycle, effectiveStatus, monthSummary, type PaymentStatus } from './stats';

export function PaymentsScreen() {
  const { t } = useTranslation();
  const { id, cycle } = useLocalSearchParams<{ id: string; cycle?: string }>();
  const data = useCommitteeData(id);

  return (
    <Screen onRefresh={data.refresh} refreshing={data.refreshing}>
      {data.ready && data.committee && data.members && data.cycles && data.payments ? (
        data.started ? (
          <PaymentsContent
            committee={data.committee}
            members={data.members}
            cycles={data.cycles}
            payments={data.payments}
            initialCycleId={cycle}
          />
        ) : (
          <EmptyState title={t('payments.notStarted')} />
        )
      ) : data.notFound ? (
        <EmptyState title={t('committee.detail.notFound')} />
      ) : data.error ? (
        <ErrorState error={data.error} onRetry={data.refresh} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function PaymentsContent({
  committee,
  members,
  cycles,
  payments,
  initialCycleId,
}: {
  committee: Committee;
  members: Member[];
  cycles: Cycle[];
  payments: Payment[];
  initialCycleId?: string;
}) {
  const { t } = useTranslation();
  const userId = useUserId();
  const today = todayInKarachi();
  const [cycleId, setCycleId] = useState(
    initialCycleId ?? currentCycle(cycles, today)?.id ?? cycles[0]?.id ?? '',
  );
  const reject = useRejectClaim(committee.id);
  const revert = useRevertPayment(committee.id);

  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) return <EmptyState title={t('payments.notStarted')} />;

  const isOrganizer = committee.organizer_id === userId;
  const isActive = committee.status === 'active';
  const month = addCalendarMonths(committee.start_month, cycle.cycle_number - 1);
  const summary = monthSummary(payments, cycle.id);
  const names = new Map(
    members.map((m) => [m.id, m.is_former_user ? t('members.formerName') : m.display_name]),
  );
  const myMemberId = members.find((m) => m.user_id === userId)?.id;
  const rows = payments
    .filter((p) => p.cycle_id === cycle.id)
    .map((payment) => ({
      payment,
      name: names.get(payment.member_id) ?? t('members.formerName'),
      status: effectiveStatus(payment.status, cycle.due_date, today),
      mine: payment.member_id === myMemberId,
    }))
    // Mine first, then needs-attention first, then by name.
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.name.localeCompare(b.name),
    );
  const mutationError = reject.error ?? revert.error;

  const openForm = (paymentId: string, mode: 'mark' | 'confirm' | 'claim') =>
    router.push(`/committee/${committee.id}/payment/${paymentId}?mode=${mode}`);

  const onReject = async (paymentId: string, name: string) => {
    const ok = await confirm({
      title: t('payments.rejectTitle'),
      message: t('payments.rejectBody', { name }),
      confirmLabel: t('payments.reject'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) reject.mutate(paymentId);
  };

  const onUndo = async (paymentId: string, name: string) => {
    const ok = await confirm({
      title: t('payments.undoTitle'),
      message: t('payments.undoBody', { name, month: formatMonth(month) }),
      confirmLabel: t('payments.undo'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) revert.mutate(paymentId);
  };

  return (
    <>
      <SelectField
        testID="payments-month"
        label={t('payments.month')}
        value={cycle.id}
        options={cycles.map((c) => ({
          value: c.id,
          label: t('payments.monthOption', {
            month: formatMonth(addCalendarMonths(committee.start_month, c.cycle_number - 1)),
            date: formatCalendarDate(c.due_date),
          }),
        }))}
        onChange={setCycleId}
      />

      <Card testID="payments-summary">
        <AppText variant="heading">
          {t('payments.collected', {
            collected: formatPKR(summary.collected),
            expected: formatPKR(summary.expected),
          })}
        </AppText>
        <AppText tone="muted">
          {t('payments.paidCount', { paid: summary.paidCount, total: summary.total })}
        </AppText>
        <AppText tone="muted">{t('payments.dueOn', { date: formatCalendarDate(cycle.due_date) })}</AppText>
        {isOrganizer && summary.awaitingCount > 0 ? (
          <AppText tone="warning" variant="bodyStrong">
            {t('payments.awaiting', { count: summary.awaitingCount })}
          </AppText>
        ) : null}
      </Card>

      {mutationError ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(mutationError))}
        </AppText>
      ) : null}

      <View style={styles.list}>
        {rows.map(({ payment, name, status, mine }) => (
          <Card key={payment.id} testID={`payment-${payment.member_id}`}>
            <View
              style={styles.rowHeader}
              accessible
              accessibilityLabel={t('payments.rowA11y', {
                name,
                amount: formatPKR(payment.amount),
                status: t(`paymentStatus.${status}`),
              })}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{mine ? `${name} (${t('order.you')})` : name}</AppText>
                <AppText tone="muted">{formatPKR(payment.amount)}</AppText>
              </View>
              <Badge label={t(`paymentStatus.${status}`)} tone={STATUS_TONE[status]} />
            </View>
            <PaymentDetailsLine payment={payment} />
            {isActive ? (
              <View style={styles.actions}>
                {isOrganizer && (status === 'pending' || status === 'late') ? (
                  <Button
                    variant="secondary"
                    label={t('payments.markPaid')}
                    onPress={() => openForm(payment.id, 'mark')}
                  />
                ) : null}
                {isOrganizer && status === 'awaiting_confirmation' ? (
                  <>
                    <Button label={t('payments.confirm')} onPress={() => openForm(payment.id, 'confirm')} />
                    <Button
                      variant="ghost"
                      label={t('payments.reject')}
                      loading={reject.isPending && reject.variables === payment.id}
                      onPress={() => void onReject(payment.id, name)}
                    />
                  </>
                ) : null}
                {isOrganizer && status === 'paid' ? (
                  <Button
                    variant="ghost"
                    label={t('payments.undo')}
                    loading={revert.isPending && revert.variables === payment.id}
                    onPress={() => void onUndo(payment.id, name)}
                  />
                ) : null}
                {!isOrganizer && mine && (status === 'pending' || status === 'late') ? (
                  <Button
                    testID="payment-claim"
                    label={t('payments.iPaid')}
                    onPress={() => openForm(payment.id, 'claim')}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
      </View>
    </>
  );
}

const STATUS_ORDER: Record<PaymentStatus, number> = {
  awaiting_confirmation: 0,
  late: 1,
  pending: 2,
  paid: 3,
};

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
