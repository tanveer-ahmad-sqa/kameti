import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { useCommittee, type Committee } from '@/features/committees/api';
import { useMembers, type Member } from '@/features/members/api';
import { confirm } from '@/lib/confirm';
import { formatCalendarDate, formatMonth, formatTimestamp, todayInKarachi } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { MIN_TAP_TARGET, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatPKR } from '@shared/money';

import { useCompletePayout, useCycles, useRevertPayout, type Cycle } from './api';
import { buildSchedule, type ScheduleRow } from './schedule';

export function ScheduleScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);
  const members = useMembers(id);
  const started = committee.data ? committee.data.status !== 'draft' : false;
  const cycles = useCycles(id, started);

  const refresh = () => {
    void committee.refetch();
    void members.refetch();
    if (started) void cycles.refetch();
  };
  const ready = committee.data && members.data && (!started || cycles.data);
  const error = committee.error ?? members.error ?? cycles.error;

  return (
    <Screen onRefresh={refresh} refreshing={members.isRefetching || cycles.isRefetching}>
      {ready && committee.data && members.data ? (
        <ScheduleContent committee={committee.data} members={members.data} cycles={cycles.data ?? []} />
      ) : committee.data === null ? (
        <EmptyState title={t('committee.detail.notFound')} />
      ) : error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function ScheduleContent({
  committee,
  members,
  cycles,
}: {
  committee: Committee;
  members: Member[];
  cycles: Cycle[];
}) {
  const { t } = useTranslation();
  const userId = useUserId();
  const complete = useCompletePayout(committee.id);
  const revert = useRevertPayout(committee.id);
  const isOrganizer = committee.organizer_id === userId;
  const isActive = committee.status === 'active';
  const rows = buildSchedule({ committee, members, cycles, userId, today: todayInKarachi() });
  const done = rows.filter((row) => row.paidOut).length;
  const hasAnyRecipient = rows.some((row) => row.recipient);
  const mutationError = complete.error ?? revert.error;

  const recipientName = (row: ScheduleRow) =>
    row.recipient
      ? row.recipient.is_former_user
        ? t('members.formerName')
        : row.recipient.display_name
      : t('schedule.toUnknown');

  const onComplete = async (row: ScheduleRow) => {
    if (!row.cycleId) return;
    const ok = await confirm({
      title: t('schedule.markPaidTitle', { month: formatMonth(row.month) }),
      message: t('schedule.markPaidBody', { name: recipientName(row), amount: formatPKR(row.amount) }),
      confirmLabel: t('schedule.markPaid'),
      cancelLabel: t('common.cancel'),
    });
    if (ok) complete.mutate(row.cycleId);
  };

  const onUndo = async (row: ScheduleRow) => {
    if (!row.cycleId) return;
    const ok = await confirm({
      title: t('schedule.undoTitle'),
      message: t('schedule.undoBody', { month: formatMonth(row.month) }),
      confirmLabel: t('schedule.undo'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) revert.mutate(row.cycleId);
  };

  return (
    <>
      {isOrganizer && isActive ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <HeaderButton
                label={t('schedule.changeOrder')}
                onPress={() => router.push(`/committee/${committee.id}/swap`)}
              />
            ),
          }}
        />
      ) : null}

      {committee.status === 'draft' ? (
        <AppText tone="warning">{hasAnyRecipient ? t('schedule.preview') : t('schedule.noOrder')}</AppText>
      ) : (
        <AppText variant="heading">{t('schedule.progress', { done, total: rows.length })}</AppText>
      )}

      {mutationError ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(mutationError))}
        </AppText>
      ) : null}

      <View style={styles.list}>
        {rows.map((row) => (
          <ScheduleCard
            key={row.number}
            row={row}
            name={recipientName(row)}
            canManage={isOrganizer && isActive && row.cycleId !== null}
            busy={
              (complete.isPending && complete.variables === row.cycleId) ||
              (revert.isPending && revert.variables === row.cycleId)
            }
            onComplete={() => void onComplete(row)}
            onUndo={() => void onUndo(row)}
          />
        ))}
      </View>
    </>
  );
}

function ScheduleCard({
  row,
  name,
  canManage,
  busy,
  onComplete,
  onUndo,
}: {
  row: ScheduleRow;
  name: string;
  canManage: boolean;
  busy: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = row.paidOut
    ? t('schedule.paidOut')
    : row.cycleId && row.isPast
      ? t('schedule.overdue')
      : t('schedule.upcoming');

  return (
    <View
      testID={`schedule-${row.number}`}
      style={[
        styles.cardFrame,
        row.isCurrentMonth && { borderColor: colors.primary, borderWidth: 2 },
        row.isMine && !row.isCurrentMonth && { borderColor: colors.warning, borderWidth: 2 },
      ]}
    >
      <Card>
        <View
          accessible
          accessibilityLabel={[
            t('schedule.rowA11y', {
              month: formatMonth(row.month),
              name,
              amount: formatPKR(row.amount),
              status,
            }),
            row.isCurrentMonth ? t('schedule.thisMonth') : null,
            row.isMine ? t('schedule.yourPayout') : null,
          ]
            .filter(Boolean)
            .join(', ')}
          style={styles.cardBody}
        >
          <View style={styles.headerRow}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {formatMonth(row.month)}
            </AppText>
            {row.isCurrentMonth ? <Badge label={t('schedule.thisMonth')} tone="primary" /> : null}
            {row.isMine ? <Badge label={t('schedule.yourPayout')} tone="warning" /> : null}
          </View>
          <AppText variant="heading">{formatPKR(row.amount)}</AppText>
          <AppText>{row.recipient ? t('schedule.to', { name }) : name}</AppText>
          <AppText variant="caption" tone="muted">
            {t('schedule.due', { date: formatCalendarDate(row.dueDate) })} ·{' '}
            {t('schedule.payoutOn', { date: formatCalendarDate(row.payoutDate) })}
          </AppText>
          <View style={styles.headerRow}>
            <Badge
              label={status}
              tone={row.paidOut ? 'success' : row.cycleId && row.isPast ? 'danger' : 'neutral'}
            />
            {row.paidOutAt ? (
              <AppText variant="caption" tone="muted">
                {t('schedule.paidOutOn', { date: formatTimestamp(row.paidOutAt) })}
              </AppText>
            ) : null}
          </View>
        </View>
        {canManage ? (
          row.paidOut ? (
            <Button variant="ghost" label={t('schedule.undo')} loading={busy} onPress={onUndo} />
          ) : (
            <Button
              testID={`schedule-complete-${row.number}`}
              variant="secondary"
              label={t('schedule.markPaid')}
              loading={busy}
              onPress={onComplete}
            />
          )
        ) : null}
      </Card>
    </View>
  );
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.headerButton}
    >
      <AppText tone="primary" variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  cardFrame: {
    borderRadius: 18,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  cardBody: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  headerButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
