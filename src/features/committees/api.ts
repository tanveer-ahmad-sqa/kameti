import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';
import { payoutDayOf, type CommitteeFormOutput } from '@shared/schemas/committee';

export type CommitteeSummary = Pick<
  Tables<'committees'>,
  'id' | 'name' | 'status' | 'contribution_amount' | 'member_count' | 'organizer_id' | 'start_month'
>;

export type Committee = Pick<
  Tables<'committees'>,
  | 'id'
  | 'name'
  | 'description'
  | 'status'
  | 'contribution_amount'
  | 'member_count'
  | 'start_month'
  | 'due_day'
  | 'payout_day'
  | 'payout_order_method'
  | 'organizer_id'
  | 'activated_at'
>;

const COMMITTEE_COLUMNS =
  'id, name, description, status, contribution_amount, member_count, start_month, due_day, payout_day, payout_order_method, organizer_id, activated_at';

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

/** One committee, or null if it doesn't exist or the user has no access (RLS). */
export function useCommittee(committeeId: string) {
  return useQuery({
    queryKey: queryKeys.committees.detail(committeeId),
    queryFn: async (): Promise<Committee | null> => {
      const { data, error } = await supabase
        .from('committees')
        .select(COMMITTEE_COLUMNS)
        .eq('id', committeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCommittee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommitteeFormOutput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_committee', {
        p_name: input.name,
        p_description: input.description,
        p_contribution_amount: input.contributionAmount,
        p_member_count: input.memberCount,
        p_start_month: input.startMonth,
        p_due_day: input.dueDay,
        p_payout_day: payoutDayOf(input.dueDay, input.payoutOffsetDays),
        p_payout_order_method: input.payoutOrderMethod,
        p_include_organizer: input.includeOrganizer,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
    },
  });
}

/** Draft-only edits (RLS + triggers reject anything else). */
export function useUpdateCommittee(committeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommitteeFormOutput): Promise<Committee> => {
      const { data, error } = await supabase
        .from('committees')
        .update({
          name: input.name,
          description: input.description === '' ? null : input.description,
          contribution_amount: input.contributionAmount,
          member_count: input.memberCount,
          start_month: input.startMonth,
          due_day: input.dueDay,
          payout_day: payoutDayOf(input.dueDay, input.payoutOffsetDays),
          payout_order_method: input.payoutOrderMethod,
        })
        .eq('id', committeeId)
        .select(COMMITTEE_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (committee) => {
      queryClient.setQueryData(queryKeys.committees.detail(committeeId), committee);
      void queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
    },
  });
}

export function useDeleteCommittee(committeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('committees').delete().eq('id', committeeId).select('id');
      if (error) throw error;
      // RLS silently filters rows the user may not delete.
      if (data.length === 0) throw { code: 'P0001', message: 'not_organizer' };
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.committees.detail(committeeId) });
      queryClient.removeQueries({ queryKey: queryKeys.members.list(committeeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
    },
  });
}

/** Organizer's display name; visible to everyone in the committee. */
export function useOrganizerName(committeeId: string) {
  return useQuery({
    queryKey: queryKeys.committees.organizerName(committeeId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('committee_organizer_name', { p_committee_id: committeeId });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
