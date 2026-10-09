import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { formatPKR } from '@shared/money';

import type { CommitteeSummary } from './api';

const STATUS_TONE = {
  draft: 'neutral',
  active: 'primary',
  completed: 'success',
} as const;

export function CommitteeCard({
  committee,
  isOrganizer,
}: {
  committee: CommitteeSummary;
  isOrganizer: boolean;
}) {
  const { t } = useTranslation();
  const amount = formatPKR(committee.contribution_amount);
  const members = t('home.members', { count: committee.member_count });
  const status = t(`status.${committee.status}`);

  return (
    <Card
      testID={`committee-${committee.id}`}
      accessibilityRole="summary"
      accessibilityLabel={t('home.committeeA11y', { name: committee.name, status, amount, members })}
    >
      <View style={styles.titleRow}>
        <AppText variant="heading" style={styles.title}>
          {committee.name}
        </AppText>
        <Badge label={status} tone={STATUS_TONE[committee.status]} />
      </View>
      <AppText tone="muted">
        {t('home.perMonth', { amount })} · {members}
      </AppText>
      {isOrganizer ? <Badge label={t('home.organizerBadge')} tone="warning" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
});
