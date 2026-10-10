import { router } from 'expo-router';
import { useMemo } from 'react';

import { addCalendarMonths, currentMonthInKarachi } from '@/lib/dates';
import { defaultPayoutOffset, type CommitteeFormInput } from '@shared/schemas/committee';

import { useCreateCommittee } from './api';
import { CommitteeForm } from './CommitteeForm';

const DEFAULT_DUE_DAY = 5;

export function CreateCommitteeScreen() {
  const create = useCreateCommittee();

  const defaultValues = useMemo<CommitteeFormInput>(
    () => ({
      name: '',
      description: '',
      contributionAmount: '',
      memberCount: '',
      // Most committees start next month.
      startMonth: addCalendarMonths(currentMonthInKarachi(), 1),
      dueDay: DEFAULT_DUE_DAY,
      payoutOffsetDays: defaultPayoutOffset(DEFAULT_DUE_DAY),
      payoutOrderMethod: 'random',
      includeOrganizer: true,
    }),
    [],
  );

  return (
    <CommitteeForm
      mode="create"
      defaultValues={defaultValues}
      submitting={create.isPending}
      submitError={create.error}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: (committeeId) => router.replace(`/committee/${committeeId}/members`),
        })
      }
    />
  );
}
