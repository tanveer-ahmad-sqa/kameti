import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  RadioGroup,
  Screen,
  SelectField,
  SwitchRow,
  TextField,
  type RadioOption,
  type SelectOption,
} from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { formatMonth, lastCommitteeMonth, upcomingMonths } from '@/lib/dates';
import { translateValidation } from '@/lib/validation';
import { spacing } from '@/theme/tokens';
import { formatPKR, potAmount } from '@shared/money';
import {
  COMMITTEE_LIMITS,
  committeeFormSchema,
  maxPayoutOffset,
  type CommitteeFormInput,
  type CommitteeFormOutput,
  type PayoutOrderMethod,
} from '@shared/schemas/committee';

/** How many months ahead an organizer can schedule the start. */
const START_MONTH_CHOICES = 12;

export type CommitteeFormProps = {
  mode: 'create' | 'edit';
  defaultValues: CommitteeFormInput;
  onSubmit: (values: CommitteeFormOutput) => void;
  submitting: boolean;
  submitError: unknown;
};

export function CommitteeForm({
  mode,
  defaultValues,
  onSubmit,
  submitting,
  submitError,
}: CommitteeFormProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, setValue, getValues, formState } = useForm<
    CommitteeFormInput,
    unknown,
    CommitteeFormOutput
  >({
    resolver: zodResolver(committeeFormSchema),
    defaultValues,
  });
  const errors = formState.errors;
  const [amountText, countText, startMonth, dueDay] = useWatch({
    control,
    name: ['contributionAmount', 'memberCount', 'startMonth', 'dueDay'],
  });

  const monthOptions = useMemo<SelectOption<string>[]>(() => {
    const months = upcomingMonths(START_MONTH_CHOICES);
    // Keep an existing draft's month selectable even if it's no longer upcoming,
    // so the form shows it (the server rejects saving a past month).
    if (defaultValues.startMonth && !months.includes(defaultValues.startMonth)) {
      months.unshift(defaultValues.startMonth);
    }
    return months.map((month) => ({ value: month, label: formatMonth(month) }));
  }, [defaultValues.startMonth]);

  const dueDayOptions = useMemo<SelectOption<number>[]>(
    () =>
      Array.from({ length: COMMITTEE_LIMITS.dayMax }, (_, i) => ({
        value: i + 1,
        label: t('committee.form.dueDayOption', { day: i + 1 }),
      })),
    [t],
  );

  const payoutOptions = useMemo<SelectOption<number>[]>(
    () =>
      Array.from({ length: maxPayoutOffset(dueDay) + 1 }, (_, offset) => ({
        value: offset,
        label:
          offset === 0
            ? t('committee.form.payoutSameDay', { day: dueDay })
            : t('committee.form.payoutAfter', { count: offset, day: dueDay + offset }),
      })),
    [dueDay, t],
  );

  const methodOptions: RadioOption<PayoutOrderMethod>[] = [
    {
      value: 'random',
      label: t('committee.form.methodRandom'),
      description: t('committee.form.methodRandomHint'),
    },
    {
      value: 'manual',
      label: t('committee.form.methodManual'),
      description: t('committee.form.methodManualHint'),
    },
    {
      value: 'member_choice',
      label: t('committee.form.methodChoice'),
      description: t('committee.form.methodChoiceHint'),
    },
  ];

  // Live summary: only when the typed numbers are valid.
  const amount = Number(amountText.replace(/[,\s]/g, ''));
  const count = Number(countText);
  const summaryValid =
    Number.isInteger(amount) &&
    amount >= COMMITTEE_LIMITS.contributionMin &&
    amount <= COMMITTEE_LIMITS.contributionMax &&
    Number.isInteger(count) &&
    count >= COMMITTEE_LIMITS.membersMin &&
    count <= COMMITTEE_LIMITS.membersMax;

  const submit = handleSubmit(onSubmit);

  return (
    <Screen
      footer={
        <>
          {submitError ? (
            <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {t(errorKey(submitError))}
            </AppText>
          ) : null}
          <Button
            testID="committee-form-submit"
            label={mode === 'create' ? t('committee.form.create') : t('common.saveChanges')}
            onPress={() => void submit()}
            loading={submitting}
          />
        </>
      }
    >
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            testID="committee-name"
            label={t('committee.form.name')}
            placeholder={t('committee.form.namePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={COMMITTEE_LIMITS.nameMax}
            autoCapitalize="words"
            error={translateValidation(t, errors.name?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="contributionAmount"
        render={({ field }) => (
          <TextField
            testID="committee-amount"
            label={t('committee.form.contribution')}
            hint={t('committee.form.contributionHint')}
            prefix={<AppText tone="muted">{t('committee.form.currency')}</AppText>}
            value={field.value}
            onChangeText={(text) => field.onChange(text.replace(/[^\d,.]/g, ''))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            placeholder="10,000"
            error={translateValidation(t, errors.contributionAmount?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="memberCount"
        render={({ field }) => (
          <TextField
            testID="committee-member-count"
            label={t('committee.form.memberCount')}
            hint={t('committee.form.memberCountHint')}
            value={field.value}
            onChangeText={(text) => field.onChange(text.replace(/\D/g, ''))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={2}
            error={translateValidation(t, errors.memberCount?.message)}
          />
        )}
      />

      {summaryValid ? (
        <Card testID="committee-pot">
          <AppText variant="caption" tone="muted">
            {t('committee.form.potTitle')}
          </AppText>
          <AppText variant="title" tone="primary" accessibilityRole="text">
            {formatPKR(potAmount(amount, count))}
          </AppText>
          <AppText tone="muted">
            {t('committee.form.potBody', { pot: formatPKR(potAmount(amount, count)) })}
          </AppText>
          {startMonth ? (
            <AppText tone="muted">
              {t('committee.form.duration', {
                count,
                from: formatMonth(startMonth),
                to: formatMonth(lastCommitteeMonth(startMonth, count)),
              })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Controller
        control={control}
        name="startMonth"
        render={({ field }) => (
          <SelectField
            testID="committee-start-month"
            label={t('committee.form.startMonth')}
            value={field.value}
            options={monthOptions}
            onChange={field.onChange}
            error={translateValidation(t, errors.startMonth?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="dueDay"
        render={({ field }) => (
          <SelectField
            testID="committee-due-day"
            label={t('committee.form.dueDay')}
            value={field.value}
            options={dueDayOptions}
            onChange={(day) => {
              field.onChange(day);
              // Keep the payout day within the 28th.
              setValue('payoutOffsetDays', Math.min(getValues('payoutOffsetDays'), maxPayoutOffset(day)));
            }}
            error={translateValidation(t, errors.dueDay?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="payoutOffsetDays"
        render={({ field }) => (
          <SelectField
            testID="committee-payout-day"
            label={t('committee.form.payoutOffset')}
            value={field.value}
            options={payoutOptions}
            onChange={field.onChange}
            error={translateValidation(t, errors.payoutOffsetDays?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="payoutOrderMethod"
        render={({ field }) => (
          <RadioGroup
            testID="committee-method"
            label={t('committee.form.orderMethod')}
            value={field.value}
            options={methodOptions}
            onChange={field.onChange}
          />
        )}
      />

      {mode === 'create' ? (
        <Controller
          control={control}
          name="includeOrganizer"
          render={({ field }) => (
            <SwitchRow
              testID="committee-include-organizer"
              label={t('committee.form.includeOrganizer')}
              hint={t('committee.form.includeOrganizerHint')}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <View>
            <TextField
              testID="committee-description"
              label={`${t('committee.form.description')} (${t('common.optional')})`}
              placeholder={t('committee.form.descriptionPlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={COMMITTEE_LIMITS.descriptionMax}
              error={translateValidation(t, errors.description?.message)}
            />
          </View>
        )}
      />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottomSpace: {
    height: spacing.lg,
  },
});
