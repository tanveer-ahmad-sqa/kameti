import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { formatPKR } from '@shared/money';

import { useCommittee, useUpdateCommittee, type Committee } from './api';
import { CommitteeForm } from './CommitteeForm';

export function EditCommitteeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);

  if (committee.data) {
    return <EditForm committee={committee.data} />;
  }
  return (
    <Screen>
      {committee.data === null ? (
        <EmptyState title={t('committee.detail.notFound')} />
      ) : committee.isError ? (
        <ErrorState error={committee.error} onRetry={() => void committee.refetch()} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function EditForm({ committee }: { committee: Committee }) {
  const update = useUpdateCommittee(committee.id);
  return (
    <CommitteeForm
      mode="edit"
      defaultValues={{
        name: committee.name,
        description: committee.description ?? '',
        contributionAmount: formatPKR(committee.contribution_amount).replace(/^Rs /, ''),
        memberCount: String(committee.member_count),
        startMonth: committee.start_month,
        dueDay: committee.due_day,
        payoutOffsetDays: committee.payout_day - committee.due_day,
        payoutOrderMethod: committee.payout_order_method,
        includeOrganizer: true,
      }}
      submitting={update.isPending}
      submitError={update.error}
      onSubmit={(values) => update.mutate(values, { onSuccess: () => router.back() })}
    />
  );
}
