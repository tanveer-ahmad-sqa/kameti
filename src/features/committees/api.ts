import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

export type CommitteeSummary = Pick<
  Tables<'committees'>,
  'id' | 'name' | 'status' | 'contribution_amount' | 'member_count' | 'organizer_id' | 'start_month'
>;

/** Every committee the user organizes or belongs to (RLS does the filtering). */
export function useMyCommittees(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.committees.mine(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<CommitteeSummary[]> => {
      const { data, error } = await supabase
        .from('committees')
        .select('id, name, status, contribution_amount, member_count, organizer_id, start_month')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
