import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';

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
import type { Committee } from '@/features/committees/api';
import { useCommitteeData } from '@/features/committees/useCommitteeData';
import type { Member } from '@/features/members/api';
import type { Payment } from '@/features/payments/api';
import { PaymentDetailsLine, STATUS_TONE } from '@/features/payments/PaymentDisplay';
import type { Cycle } from '@/features/payout/api';
import { addCalendarMonths, formatMonth, formatTimestamp, todayInKarachi } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

import { buildHistory, buildShareText, memberDisplayName } from './history';

export function HistoryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useCommitteeData(id);

  return (
    <Screen onRefresh={data.refresh} refreshing={data.refreshing}>
      {data.ready && data.committee && data.members && data.cycles && data.payments ? (
        data.started ? (
          <HistoryContent
            committee={data.committee}
            members={data.members}
            cycles={data.cycles}
            payments={data.payments}
          />
        ) : (
          <EmptyState title={t('history.notStarted')} />
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

function HistoryContent({
  committee,
  members,
  cycles,
  payments,
}: {
  committee: Committee;
  members: Member[];
  cycles: Cycle[];
  payments: Payment[];
}) {
  const { t } = useTranslation();
  const [cycleId, setCycleId] = useState('');
  const [memberId, setMemberId] = useState('');
  const formerUser = t('members.formerName');

  const months = buildHistory({
    startMonth: committee.start_month,
    members,
    cycles,
    payments,
    filter: { cycleId: cycleId || null, memberId: memberId || null },
    today: todayInKarachi(),
    formerUser,
  });
  const selectedMember = members.find((m) => m.id === memberId);

  const share = () => {
    void Share.share({
      message: buildShareText(t, {
        committee,
        months,
        cycles,
        memberName: selectedMember ? memberDisplayName(selectedMember, formerUser) : null,
      }),
    });
  };

  return (
    <>
      <SelectField
        testID="history-month"
        label={t('history.filterMonth')}
        value={cycleId}
        options={[
          { value: '', label: t('history.allMonths') },
          ...[...cycles]
            .sort((a, b) => a.cycle_number - b.cycle_number)
            .map((c) => ({
              value: c.id,
              label: formatMonth(addCalendarMonths(committee.start_month, c.cycle_number - 1)),
            })),
        ]}
        onChange={setCycleId}
      />
      <SelectField
        testID="history-member"
        label={t('history.filterMember')}
        value={memberId}
        options={[
          { value: '', label: t('history.allMembers') },
          ...members.map((m) => ({ value: m.id, label: memberDisplayName(m, formerUser) })),
        ]}
        onChange={setMemberId}
      />
      <Button testID="history-share" variant="secondary" label={t('history.share')} onPress={share} />

      {months.length === 0 ? (
        <EmptyState title={t('history.empty')} />
      ) : (
        <View style={styles.list}>
          {months.map((month) => (
            <Card key={month.cycle.id}>
              <AppText variant="heading">{formatMonth(month.month)}</AppText>
              <AppText tone={month.cycle.payout_status === 'completed' ? 'success' : 'muted'}>
                {t('history.payoutLine', {
                  name: month.recipientName,
                  status:
                    month.cycle.payout_status === 'completed' && month.cycle.payout_completed_at
                      ? t('history.payoutDone', { date: formatTimestamp(month.cycle.payout_completed_at) })
                      : t('history.payoutPending'),
                })}
              </AppText>
              {month.payments.map((row) => (
                <View key={row.payment.id} style={styles.payment}>
                  <View style={styles.paymentHeader}>
                    <AppText style={styles.flex}>{row.memberName}</AppText>
                    <Badge label={t(`paymentStatus.${row.status}`)} tone={STATUS_TONE[row.status]} />
                  </View>
                  <PaymentDetailsLine payment={row.payment} />
                </View>
              ))}
            </Card>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  payment: {
    gap: 2,
    paddingTop: spacing.xs,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
