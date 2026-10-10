import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  RadioGroup,
  Screen,
  TextField,
  type RadioOption,
} from '@/components/ui';
import { useCommitteeData } from '@/features/committees/useCommitteeData';
import { addCalendarMonths, formatMonth } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { formatPKR } from '@shared/money';

import { PAYMENT_METHODS, useClaimPayment, useConfirmPayment, type PaymentMethod } from './api';

type Mode = 'mark' | 'confirm' | 'claim';
type MethodChoice = PaymentMethod | 'none';

/**
 * Organizer: mark paid / confirm a claim. Member: "I've paid".
 * Method and note are optional in every mode.
 */
export function PaymentFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; paymentId: string; mode?: string }>();
  const mode: Mode = params.mode === 'claim' || params.mode === 'confirm' ? params.mode : 'mark';
  const data = useCommitteeData(params.id);
  const claim = useClaimPayment(params.id);
  const confirmPayment = useConfirmPayment(params.id);
  const mutation = mode === 'claim' ? claim : confirmPayment;

  const payment = data.payments?.find((p) => p.id === params.paymentId);
  const [method, setMethod] = useState<MethodChoice | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);

  const title =
    mode === 'claim'
      ? t('payments.form.claimTitle')
      : mode === 'confirm'
        ? t('payments.form.confirmTitle')
        : t('payments.form.markTitle');

  if (!payment || !data.committee) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        {data.notFound || (data.ready && !payment) ? (
          <EmptyState title={t('errors.not_found')} />
        ) : data.error ? (
          <ErrorState error={data.error} onRetry={data.refresh} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const cycle = data.cycles?.find((c) => c.id === payment.cycle_id);
  const member = data.members?.find((m) => m.id === payment.member_id);
  const chosenMethod: MethodChoice = method ?? payment.method ?? 'none';
  const noteValue = note ?? payment.note ?? '';

  const methodOptions: RadioOption<MethodChoice>[] = [
    { value: 'none', label: t('paymentMethod.none') },
    ...PAYMENT_METHODS.map((value) => ({ value, label: t(`paymentMethod.${value}`) })),
  ];

  const submit = () => {
    mutation.mutate(
      {
        paymentId: payment.id,
        method: chosenMethod === 'none' ? null : chosenMethod,
        note: noteValue.trim(),
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen
        footer={
          <>
            {mutation.isError ? (
              <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {t(errorKey(mutation.error))}
              </AppText>
            ) : null}
            <Button
              testID="payment-form-submit"
              label={
                mode === 'claim'
                  ? t('payments.form.submitClaim')
                  : mode === 'confirm'
                    ? t('payments.form.submitConfirm')
                    : t('payments.form.submitMark')
              }
              loading={mutation.isPending}
              onPress={submit}
            />
          </>
        }
      >
        <AppText variant="heading">
          {t('payments.form.summary', {
            name: member?.is_former_user ? t('members.formerName') : (member?.display_name ?? ''),
            month: cycle
              ? formatMonth(addCalendarMonths(data.committee.start_month, cycle.cycle_number - 1))
              : '',
            amount: formatPKR(payment.amount),
          })}
        </AppText>
        {mode === 'claim' ? <AppText tone="muted">{t('payments.form.claimIntro')}</AppText> : null}
        <RadioGroup
          testID="payment-method"
          label={t('payments.form.method')}
          value={chosenMethod}
          options={methodOptions}
          onChange={setMethod}
        />
        <TextField
          testID="payment-note"
          label={`${t('payments.form.note')} (${t('common.optional')})`}
          placeholder={t('payments.form.notePlaceholder')}
          value={noteValue}
          onChangeText={setNote}
          maxLength={500}
          multiline
        />
      </Screen>
    </>
  );
}
