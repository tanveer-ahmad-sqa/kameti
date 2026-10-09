import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, TextField } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { errorKey } from '@/lib/errors';
import { translateValidation } from '@/lib/validation';
import { spacing } from '@/theme/tokens';
import { profileSchema, type ProfileInput } from '@shared/schemas/auth';

import { useUpdateProfile } from './api';

export function ProfileSetupScreen() {
  const userId = useUserId();
  // The root layout only shows this screen to signed-in users.
  if (!userId) return null;
  return <ProfileSetupForm userId={userId} />;
}

function ProfileSetupForm({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const update = useUpdateProfile(userId);
  const { control, handleSubmit, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '' },
  });

  // On success the cached profile has a name, and the root layout moves to the app.
  const onSubmit = handleSubmit((values) => update.mutate(values));

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppText variant="title">{t('auth.profile.title')}</AppText>
        <AppText tone="muted">{t('auth.profile.subtitle')}</AppText>
      </View>

      <Controller
        control={control}
        name="fullName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            testID="profile-name"
            label={t('auth.profile.nameLabel')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => void onSubmit()}
            error={translateValidation(t, formState.errors.fullName?.message)}
          />
        )}
      />

      {update.isError ? (
        <AppText tone="danger" accessibilityRole="alert">
          {t(errorKey(update.error))}
        </AppText>
      ) : null}

      <Button
        testID="profile-submit"
        label={t('auth.profile.submit')}
        onPress={() => void onSubmit()}
        loading={update.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
