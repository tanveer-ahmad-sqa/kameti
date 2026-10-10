import { useMembers } from '@/features/members/api';
import { usePayments } from '@/features/payments/api';
import { useCycles } from '@/features/payout/api';

import { useCommittee } from './api';

/**
 * Committee + members + cycles + payments, the data behind dashboards, payments and history.
 * Cycles and payments only exist once the committee has started.
 */
export function useCommitteeData(committeeId: string) {
  const committee = useCommittee(committeeId);
  const started = committee.data ? committee.data.status !== 'draft' : false;
  const members = useMembers(committeeId);
  const cycles = useCycles(committeeId, started);
  const payments = usePayments(committeeId, started);

  const ready =
    committee.data !== undefined &&
    members.data !== undefined &&
    (!started || (cycles.data !== undefined && payments.data !== undefined));

  return {
    committee: committee.data,
    members: members.data,
    cycles: started ? cycles.data : [],
    payments: started ? payments.data : [],
    started,
    ready,
    notFound: committee.data === null,
    error: committee.error ?? members.error ?? (started ? (cycles.error ?? payments.error) : null),
    refreshing:
      committee.isRefetching || members.isRefetching || cycles.isRefetching || payments.isRefetching,
    refresh: () => {
      void committee.refetch();
      void members.refetch();
      if (started) {
        void cycles.refetch();
        void payments.refetch();
      }
    },
  };
}
