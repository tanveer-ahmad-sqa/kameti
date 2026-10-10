import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { useMembers, type Member } from '@/features/members/api';
import { useActivateCommittee, useCycles } from '@/features/payout/api';
import { confirm } from '@/lib/confirm';
import { addCalendarMonths, currentMonthInKarachi, formatCalendarDate, formatMonth } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';
import { formatPKR, potAmount } from '@shared/money';

import { useCommittee, useDeleteCommittee, useOrganizerName, type Committee } from './api';

const STATUS_TONE = { draft: 'neutral', active: 'primary', completed: 'success' } as const;

export function CommitteeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);
  const members = useMembers(id);
  const organizerName = useOrganizerName(id);

  const refresh = () => {
    void committee.refetch();
    void members.refetch();
    void organizerName.refetch();
  };

  return (
    <>
      <Stack.Screen options={{ title: committee.data?.name ?? '' }} />
      <Screen onRefresh={refresh} refreshing={committee.isRefetching || members.isRefetching}>
        {committee.data ? (
          <CommitteeOverview
            committee={committee.data}
            members={members.data}
            organizerName={organizerName.data ?? null}
          />
        ) : committee.data === null ? (
          <EmptyState title={t('committee.detail.notFound')} />
        ) : committee.isError ? (
          <ErrorState error={committee.error} onRetry={refresh} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    </>
  );
}

function CommitteeOverview({
  committee,
  members,
  organizerName,
}: {
  committee: Committee;
  members: Member[] | undefined;
  organizerName: string | null;
}) {
  const { t } = useTranslation();
  const userId = useUserId();
  const remove = useDeleteCommittee(committee.id);
  const activate = useActivateCommittee(committee.id);
  const isOrganizer = committee.organizer_id === userId;
  const isDraft = committee.status === 'draft';
  const cycles = useCycles(committee.id, !isDraft);
  const memberCount = members?.length;
  const allAdded = memberCount !== undefined && memberCount >= committee.member_count;
  const assignedTurns = members?.filter((m) => m.turn_number !== null).length ?? 0;
  const freeMonths = committee.member_count - assignedTurns;
  const orderComplete = allAdded && freeMonths === 0;
  const startMonthPassed = committee.start_month < currentMonthInKarachi();
  const canStart = isOrganizer && isDraft && orderComplete && !startMonthPassed;
  const me = members?.find((m) => m.user_id === userId);
  const myMonth = me?.turn_number ? addCalendarMonths(committee.start_month, me.turn_number - 1) : null;
  const nextCycle = cycles.data?.find((cycle) => cycle.payout_status === 'pending');
  const nextRecipient = nextCycle ? members?.find((m) => m.id === nextCycle.recipient_member_id) : undefined;
  const memberChoosesMonth =
    isDraft && !isOrganizer && committee.payout_order_method === 'member_choice' && Boolean(me);

  const onStart = async () => {
    const ok = await confirm({
      title: t('committee.detail.startTitle'),
      message: t('committee.detail.startBody', { month: formatMonth(committee.start_month) }),
      confirmLabel: t('committee.detail.start'),
      cancelLabel: t('common.cancel'),
    });
    if (ok) activate.mutate();
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: t('committee.detail.deleteTitle'),
      message: t('committee.detail.deleteBody', { name: committee.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) {
      remove.mutate(undefined, { onSuccess: () => router.replace('/') });
    }
  };

  return (
    <>
      <View style={styles.badges}>
        <Badge label={t(`status.${committee.status}`)} tone={STATUS_TONE[committee.status]} />
        {isOrganizer ? <Badge label={t('home.organizerBadge')} tone="warning" /> : null}
      </View>

      {committee.description ? <AppText tone="muted">{committee.description}</AppText> : null}

      <Card>
        <InfoRow
          label={t('committee.detail.contribution')}
          value={formatPKR(committee.contribution_amount)}
        />
        <InfoRow
          label={t('committee.detail.pot')}
          value={formatPKR(potAmount(committee.contribution_amount, committee.member_count))}
        />
        <InfoRow label={t('committee.detail.starts')} value={formatMonth(committee.start_month)} />
        <InfoRow
          label={t('committee.detail.due')}
          value={t('committee.detail.dueValue', { day: committee.due_day })}
        />
        <InfoRow
          label={t('committee.detail.payout')}
          value={t('committee.detail.payoutValue', { day: committee.payout_day })}
        />
        <InfoRow
          label={t('committee.detail.order')}
          value={t(`committee.methods.${committee.payout_order_method}`)}
        />
        {organizerName ? (
          <InfoRow
            label={t('committee.detail.organizer')}
            value={isOrganizer ? `${organizerName} (${t('committee.detail.you')})` : organizerName}
          />
        ) : null}
        <InfoRow
          label={t('committee.detail.members')}
          value={
            memberCount === undefined
              ? '…'
              : t('committee.detail.membersProgress', { added: memberCount, total: committee.member_count })
          }
        />
      </Card>

      {isDraft ? (
        <AppText variant="caption" tone="muted">
          {t('committee.detail.draftNotice')}
        </AppText>
      ) : null}

      {myMonth ? (
        <AppText variant="bodyStrong" tone="warning">
          {t('committee.detail.yourMonth', { month: formatMonth(myMonth) })}
        </AppText>
      ) : null}
      {nextCycle && nextRecipient ? (
        <AppText>
          {t('committee.detail.nextPayout', {
            name: nextRecipient.is_former_user ? t('members.formerName') : nextRecipient.display_name,
            date: formatCalendarDate(nextCycle.payout_date),
          })}
        </AppText>
      ) : null}

      {isOrganizer && isDraft ? (
        <Card testID="committee-setup">
          <AppText variant="heading">{t('committee.detail.setupTitle')}</AppText>
          <AppText tone={allAdded ? 'success' : 'default'}>
            {allAdded
              ? `✓ ${t('committee.detail.setupDone')}`
              : `• ${t('committee.detail.setupMembers', { count: committee.member_count })}`}
          </AppText>
          <AppText tone={orderComplete ? 'success' : 'default'}>
            {orderComplete
              ? `✓ ${t('committee.detail.setupOrderDone')}`
              : `• ${
                  committee.payout_order_method === 'random'
                    ? t('committee.detail.setupOrderRandom')
                    : committee.payout_order_method === 'manual'
                      ? t('committee.detail.setupOrderManual')
                      : t('committee.detail.setupOrderMissing', { count: freeMonths })
                }`}
          </AppText>
          {startMonthPassed ? (
            <AppText tone="danger">{`• ${t('committee.detail.setupStartMonthPast')}`}</AppText>
          ) : null}
          {activate.isError ? (
            <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {t(errorKey(activate.error))}
            </AppText>
          ) : null}
          <Button
            testID="committee-start"
            label={t('committee.detail.start')}
            disabled={!canStart}
            loading={activate.isPending}
            onPress={() => void onStart()}
          />
        </Card>
      ) : null}

      {isDraft && (isOrganizer || memberChoosesMonth || committee.payout_order_method !== 'member_choice') ? (
        <Button
          testID="committee-order"
          variant={memberChoosesMonth ? 'primary' : 'secondary'}
          label={memberChoosesMonth ? t('committee.detail.chooseMonth') : t('committee.detail.payoutOrder')}
          onPress={() => router.push(`/committee/${committee.id}/order`)}
        />
      ) : null}
      <Button
        testID="committee-schedule"
        variant="secondary"
        label={t('committee.detail.schedule')}
        onPress={() => router.push(`/committee/${committee.id}/schedule`)}
      />

      <Button
        testID="committee-members"
        label={
          isOrganizer && isDraft ? t('committee.detail.manageMembers') : t('committee.detail.viewMembers')
        }
        onPress={() => router.push(`/committee/${committee.id}/members`)}
      />

      {isOrganizer && isDraft ? (
        <>
          <Button
            testID="committee-edit"
            variant="secondary"
            label={t('committee.detail.editDetails')}
            onPress={() => router.push(`/committee/${committee.id}/edit`)}
          />
          {remove.isError ? (
            <AppText tone="danger" accessibilityRole="alert">
              {t(errorKey(remove.error))}
            </AppText>
          ) : null}
          <Button
            testID="committee-delete"
            variant="ghost"
            label={t('committee.detail.deleteCommittee')}
            onPress={() => void onDelete()}
            loading={remove.isPending}
          />
        </>
      ) : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText tone="muted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    flexShrink: 1,
  },
  rowValue: {
    flexShrink: 1,
  },
});
