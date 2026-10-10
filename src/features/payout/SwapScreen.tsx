import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  TextField,
  type SelectOption,
} from '@/components/ui';
import { useCommittee } from '@/features/committees/api';
import { useMembers } from '@/features/members/api';
import { confirm } from '@/lib/confirm';
import { addCalendarMonths, formatMonth } from '@/lib/dates';
import { errorKey } from '@/lib/errors';

import { useCycles, useSwapPayoutTurns } from './api';

/** Organizer swaps two not-yet-paid months after the committee has started. */
export function SwapScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);
  const members = useMembers(id);
  const cycles = useCycles(id);
  const swap = useSwapPayoutTurns(id);

  const [cycleA, setCycleA] = useState<string>();
  const [cycleB, setCycleB] = useState<string>();
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState<string>();

  if (!committee.data || !members.data || !cycles.data) {
    const error = committee.error ?? members.error ?? cycles.error;
    return (
      <Screen>
        {committee.data === null ? (
          <EmptyState title={t('committee.detail.notFound')} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void cycles.refetch()} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const startMonth = committee.data.start_month;
  const names = new Map(
    members.data.map((m) => [m.id, m.is_former_user ? t('members.formerName') : m.display_name]),
  );
  const options: SelectOption<string>[] = cycles.data
    .filter((cycle) => cycle.payout_status === 'pending')
    .map((cycle) => ({
      value: cycle.id,
      label: t('swap.option', {
        month: formatMonth(addCalendarMonths(startMonth, cycle.cycle_number - 1)),
        name: names.get(cycle.recipient_member_id) ?? '',
      }),
    }));
  const labelOf = (cycleId: string | undefined) => options.find((o) => o.value === cycleId)?.label ?? '';

  const submit = async () => {
    if (!cycleA || !cycleB || cycleA === cycleB) {
      setValidation(t('validation.swap_same'));
      return;
    }
    if (reason.trim().length < 3) {
      setValidation(t('validation.reason_required'));
      return;
    }
    setValidation(undefined);
    const ok = await confirm({
      title: t('swap.confirmTitle'),
      message: t('swap.confirmBody', { a: labelOf(cycleA), b: labelOf(cycleB) }),
      confirmLabel: t('swap.submit'),
      cancelLabel: t('common.cancel'),
    });
    if (ok) {
      swap.mutate({ cycleA, cycleB, reason: reason.trim() }, { onSuccess: () => router.back() });
    }
  };

  if (options.length < 2) {
    return (
      <Screen>
        <EmptyState title={t('swap.noneAvailable')} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {validation || swap.isError ? (
            <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {validation ?? t(errorKey(swap.error))}
            </AppText>
          ) : null}
          <Button
            testID="swap-submit"
            label={t('swap.submit')}
            loading={swap.isPending}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <AppText tone="muted">{t('swap.intro')}</AppText>
      <SelectField
        testID="swap-a"
        label={t('swap.first')}
        value={cycleA}
        options={options}
        onChange={setCycleA}
      />
      <SelectField
        testID="swap-b"
        label={t('swap.second')}
        value={cycleB}
        options={options.filter((option) => option.value !== cycleA)}
        onChange={setCycleB}
      />
      <TextField
        testID="swap-reason"
        label={t('swap.reason')}
        placeholder={t('swap.reasonPlaceholder')}
        hint={t('swap.reasonHint')}
        value={reason}
        onChangeText={setReason}
        maxLength={300}
        multiline
      />
    </Screen>
  );
}
