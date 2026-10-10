import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';
import type { DrawResponse } from '@shared/schemas/draw';

export type Cycle = Pick<
  Tables<'cycles'>,
  | 'id'
  | 'cycle_number'
  | 'due_date'
  | 'payout_date'
  | 'recipient_member_id'
  | 'payout_status'
  | 'payout_completed_at'
  | 'payout_note'
>;

export type Draw = Pick<Tables<'payout_draws'>, 'id' | 'created_at' | 'result'>;

export function useCycles(committeeId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cycles.list(committeeId),
    enabled,
    queryFn: async (): Promise<Cycle[]> => {
      const { data, error } = await supabase
        .from('cycles')
        .select(
          'id, cycle_number, due_date, payout_date, recipient_member_id, payout_status, payout_completed_at, payout_note',
        )
        .eq('committee_id', committeeId)
        .order('cycle_number');
      if (error) throw error;
      return data;
    },
  });
}

export function useDraws(committeeId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.draws.list(committeeId),
    enabled,
    queryFn: async (): Promise<Draw[]> => {
      const { data, error } = await supabase
        .from('payout_draws')
        .select('id, created_at, result')
        .eq('committee_id', committeeId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Everything that changes when the order, status or payouts change. */
function useInvalidateCommittee(committeeId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list(committeeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.list(committeeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.draws.list(committeeId) }),
    ]);
}

/** Turns an Edge Function error response `{ error: '<code>' }` into the same shape as DB errors. */
async function functionError(error: unknown): Promise<unknown> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body: unknown = await context.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return { code: 'P0001', message: body.error, status: context.status };
      }
    } catch {
      // Not JSON: fall through to the original error.
    }
  }
  return error;
}

export function useRunDraw(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (): Promise<DrawResponse> => {
      const { data, error } = await supabase.functions.invoke<DrawResponse>('draw-payout-order', {
        body: { committeeId },
      });
      if (error) throw await functionError(error);
      if (!data) throw new Error('Empty draw response');
      return data;
    },
    onSettled: invalidate,
  });
}

export function useSetPayoutOrder(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const { error } = await supabase.rpc('set_payout_order', {
        p_committee_id: committeeId,
        p_member_ids: memberIds,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Organizer assigns (or clears, with null) a month in a member-choice committee. */
export function useAssignTurn(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async ({ memberId, turn }: { memberId: string; turn: number | null }) => {
      const { error } = await supabase.rpc('assign_turn', {
        p_committee_id: committeeId,
        p_member_id: memberId,
        // The generated type says number, but the function accepts NULL to clear a turn.
        p_turn: turn as number,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** A member picks (or releases, with null) their own month. */
export function useChooseTurn(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (turn: number | null) => {
      const { error } = await supabase.rpc('choose_turn', {
        p_committee_id: committeeId,
        p_turn: turn as number,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useActivateCommittee(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('activate_committee', { p_committee_id: committeeId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useCompletePayout(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase.rpc('complete_payout', { p_cycle_id: cycleId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRevertPayout(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase.rpc('revert_payout', { p_cycle_id: cycleId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useSwapPayoutTurns(committeeId: string) {
  const invalidate = useInvalidateCommittee(committeeId);
  return useMutation({
    mutationFn: async (input: { cycleA: string; cycleB: string; reason: string }) => {
      const { error } = await supabase.rpc('swap_payout_turns', {
        p_cycle_a: input.cycleA,
        p_cycle_b: input.cycleB,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
