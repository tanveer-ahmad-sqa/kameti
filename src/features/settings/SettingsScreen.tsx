import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { useSignOut } from '@/features/auth/api';
import { useUserId } from '@/features/auth/authStore';
import { useProfile } from '@/features/profile/api';
import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';
import { formatPkMobile } from '@shared/schemas/phone';

export function SettingsScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const profile = useProfile(userId);
  const signOut = useSignOut();

  return (
    <Screen>
      <AppText variant="heading">{t('settings.account')}</AppText>
      <Card>
        <Row label={t('settings.name')} value={profile.data?.full_name ?? '—'} />
        <Row label={t('settings.phone')} value={profile.data ? formatPkMobile(profile.data.phone) : '—'} />
      </Card>

      {signOut.isError ? (
        <AppText tone="danger" accessibilityRole="alert">
          {t(errorKey(signOut.error))}
        </AppText>
      ) : null}
      <Button
        testID="sign-out"
        variant="secondary"
        label={t('auth.signOut')}
        onPress={() => signOut.mutate()}
        loading={signOut.isPending}
      />

      <AppText variant="caption" tone="muted" style={styles.version}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
      </AppText>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.xs,
  },
  version: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
