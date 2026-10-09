import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useIsOnline } from '@/lib/useIsOnline';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

export function OfflineBanner() {
  const isOnline = useIsOnline();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (isOnline) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={t('offline.bannerA11y')}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: colors.warningSoft }]}
    >
      <AppText variant="caption" tone="warning">
        {t('offline.banner')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
