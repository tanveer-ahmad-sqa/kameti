import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { MIN_TAP_TARGET, spacing } from '@/theme/tokens';

import { useMyCommittees } from './api';
import { CommitteeCard } from './CommitteeCard';

export function HomeScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const committees = useMyCommittees(userId);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.settings')}
                hitSlop={8}
                style={styles.headerButton}
              >
                <AppText tone="primary" variant="bodyStrong">
                  {t('home.settings')}
                </AppText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <Screen onRefresh={() => void committees.refetch()} refreshing={committees.isRefetching}>
        {committees.data ? (
          committees.data.length === 0 ? (
            <EmptyState title={t('home.emptyTitle')} body={t('home.emptyBody')} />
          ) : (
            <View style={styles.list}>
              {committees.data.map((committee) => (
                <CommitteeCard
                  key={committee.id}
                  committee={committee}
                  isOrganizer={committee.organizer_id === userId}
                />
              ))}
            </View>
          )
        ) : committees.isError ? (
          <ErrorState error={committees.error} onRetry={() => void committees.refetch()} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  headerButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
