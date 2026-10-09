import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, Screen, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { translateValidation } from '@/lib/validation';
import { spacing } from '@/theme/tokens';
import { pkMobileSchema } from '@shared/schemas/phone';

import { useSendOtp } from './api';

const formSchema = z.object({ phone: pkMobileSchema });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function SignInScreen() {
  const { t } = useTranslation();
  const sendOtp = useSendOtp();
  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = handleSubmit(({ phone }) => {
    sendOtp.mutate(phone, {
      onSuccess: () => router.push({ pathname: '/verify', params: { phone } }),
    });
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppText variant="title">{t('auth.signIn.title')}</AppText>
        <AppText tone="muted">{t('auth.signIn.subtitle')}</AppText>
      </View>

      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            testID="sign-in-phone"
            label={t('auth.signIn.phoneLabel')}
            placeholder={t('auth.signIn.phonePlaceholder')}
            hint={t('auth.signIn.phoneHint')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="done"
            onSubmitEditing={() => void onSubmit()}
            error={translateValidation(t, formState.errors.phone?.message)}
          />
        )}
      />

      {sendOtp.isError ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(sendOtp.error))}
        </AppText>
      ) : null}

      <Button
        testID="sign-in-submit"
        label={t('auth.signIn.submit')}
        onPress={() => void onSubmit()}
        loading={sendOtp.isPending}
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
