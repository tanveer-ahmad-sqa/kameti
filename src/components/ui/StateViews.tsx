import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const text = label ?? t('common.loading');
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={text}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText tone="muted">{text}</AppText>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={styles.centerText}>
        {title}
      </AppText>
      {body ? (
        <AppText tone="muted" style={styles.centerText}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = error ? t(errorKey(error)) : t('states.errorBody');
  return (
    <View style={styles.center} accessibilityRole="alert">
      <AppText variant="heading" style={styles.centerText}>
        {t('states.errorTitle')}
      </AppText>
      <AppText tone="muted" style={styles.centerText}>
        {message}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  centerText: {
    textAlign: 'center',
  },
});
