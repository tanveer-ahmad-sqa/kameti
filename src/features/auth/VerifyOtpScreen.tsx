import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { translateValidation } from '@/lib/validation';
import { spacing } from '@/theme/tokens';
import { otpCodeSchema } from '@shared/schemas/auth';
import { formatPkMobile, PK_MOBILE_E164 } from '@shared/schemas/phone';

import { useSendOtp, useVerifyOtp } from './api';

const RESEND_SECONDS = 30;

export function VerifyOtpScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = typeof params.phone === 'string' && PK_MOBILE_E164.test(params.phone) ? params.phone : null;

  const verify = useVerifyOtp();
  const resend = useSendOtp();
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (!phone) router.replace('/sign-in');
  }, [phone]);

  if (!phone) return null;

  const submit = (value: string) => {
    const parsed = otpCodeSchema.safeParse(value);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message);
      return;
    }
    setValidationError(undefined);
    // On success the auth listener updates the session and the root layout redirects.
    verify.mutate({ phone, token: parsed.data });
  };

  const onChangeCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !verify.isPending) submit(digits);
  };

  const onResend = () => {
    resend.mutate(phone, { onSuccess: () => setSecondsLeft(RESEND_SECONDS) });
  };

  const serverError = verify.isError ? verify.error : resend.isError ? resend.error : null;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">{t('auth.verify.title')}</AppText>
        <AppText tone="muted">{t('auth.verify.subtitle', { phone: formatPkMobile(phone) })}</AppText>
      </View>

      <TextField
        testID="verify-code"
        label={t('auth.verify.codeLabel')}
        value={code}
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
        error={translateValidation(t, validationError)}
      />

      {serverError ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(serverError))}
        </AppText>
      ) : null}
      {resend.isSuccess && !resend.isPending ? (
        <AppText tone="success" accessibilityLiveRegion="polite">
          {t('auth.verify.resent')}
        </AppText>
      ) : null}

      <Button
        testID="verify-submit"
        label={t('auth.verify.submit')}
        onPress={() => submit(code)}
        loading={verify.isPending}
      />

      {secondsLeft > 0 ? (
        <AppText tone="muted" style={styles.center} accessibilityLiveRegion="none">
          {t('auth.verify.resendIn', { seconds: secondsLeft })}
        </AppText>
      ) : (
        <Button
          variant="ghost"
          label={t('auth.verify.resend')}
          onPress={onResend}
          loading={resend.isPending}
        />
      )}
      <Button variant="ghost" label={t('auth.verify.changeNumber')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  center: {
    textAlign: 'center',
  },
});
