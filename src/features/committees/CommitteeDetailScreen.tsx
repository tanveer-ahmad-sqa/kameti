import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { useMembers } from '@/features/members/api';
import { confirm } from '@/lib/confirm';
import { formatMonth } from '@/lib/dates';
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
            memberCount={members.data?.length}
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
  memberCount,
  organizerName,
}: {
  committee: Committee;
  memberCount: number | undefined;
  organizerName: string | null;
}) {
  const { t } = useTranslation();
  const userId = useUserId();
  const remove = useDeleteCommittee(committee.id);
  const isOrganizer = committee.organizer_id === userId;
  const isDraft = committee.status === 'draft';
  const allAdded = memberCount !== undefined && memberCount >= committee.member_count;

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

      {isOrganizer && isDraft ? (
        <Card>
          <AppText variant="heading">{t('committee.detail.setupTitle')}</AppText>
          <AppText tone={allAdded ? 'success' : 'default'}>
            {allAdded
              ? `✓ ${t('committee.detail.setupDone')}`
              : `• ${t('committee.detail.setupMembers', { count: committee.member_count })}`}
          </AppText>
        </Card>
      ) : null}

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
