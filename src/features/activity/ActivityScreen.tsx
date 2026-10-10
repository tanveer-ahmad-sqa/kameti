import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useOrganizerName } from '@/features/committees/api';
import { useCommitteeData } from '@/features/committees/useCommitteeData';
import { formatTimestamp } from '@/lib/dates';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useActivity } from './api';
import { describeActivity, type ActivityContext } from './describe';

export function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useCommitteeData(id);
  const organizerName = useOrganizerName(id);
  const activity = useActivity(id);

  // Plain computation: the React Compiler memoizes it.
  const ctx: ActivityContext = (() => {
    const byMemberId = new Map(
      (data.members ?? []).map((m) => [m.id, m.is_former_user ? t('members.formerName') : m.display_name]),
    );
    const byUserId = new Map(
      (data.members ?? []).flatMap((m) => (m.user_id ? [[m.user_id, m.display_name] as const] : [])),
    );
    if (data.committee?.organizer_id && organizerName.data) {
      byUserId.set(data.committee.organizer_id, organizerName.data);
    }
    const cycleNumbers = new Map((data.cycles ?? []).map((c) => [c.id, c.cycle_number]));
    return {
      memberName: (memberId) => (memberId && byMemberId.get(memberId)) || t('activity.unknownMember'),
      actorName: (userId) =>
        userId === null ? t('activity.system') : (byUserId.get(userId) ?? t('members.formerName')),
      cycleNumber: (cycleId) => (cycleId ? cycleNumbers.get(cycleId) : undefined),
    };
  })();

  const entries = activity.data?.pages.flat() ?? [];

  if (!activity.data || !data.ready) {
    return (
      <Screen>
        {data.notFound ? (
          <EmptyState title={t('committee.detail.notFound')} />
        ) : activity.isError || data.error ? (
          <ErrorState
            error={activity.error ?? data.error}
            onRetry={() => {
              data.refresh();
              void activity.refetch();
            }}
          />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={activity.isRefetching}
            onRefresh={() => {
              data.refresh();
              void activity.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={<EmptyState title={t('activity.empty')} />}
        renderItem={({ item }) => (
          <View
            style={[styles.entry, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessible
          >
            <AppText>{describeActivity(t, item, ctx)}</AppText>
            <AppText variant="caption" tone="muted">
              {formatTimestamp(item.created_at)}
            </AppText>
          </View>
        )}
        ListFooterComponent={
          activity.hasNextPage ? (
            <Button
              variant="secondary"
              label={t('activity.loadMore')}
              loading={activity.isFetchingNextPage}
              onPress={() => void activity.fetchNextPage()}
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  entry: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
