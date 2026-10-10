import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Enums, Tables } from '@/types/database.types';

export type Payment = Pick<
  Tables<'payments'>,
  'id' | 'cycle_id' | 'member_id' | 'amount' | 'status' | 'method' | 'note' | 'claimed_at' | 'paid_at'
>;
export type PaymentMethod = Enums<'payment_method'>;

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'easypaisa', 'jazzcash', 'bank_transfer'];

/** All payments of a committee (at most 50 members x 50 months). */
export function usePayments(committeeId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.list(committeeId),
    enabled,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, cycle_id, member_id, amount, status, method, note, claimed_at, paid_at')
        .eq('committee_id', committeeId)
        .limit(2500);
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidatePayments(committeeId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.list(committeeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.list(committeeId) }),
      // A payment can complete the whole committee.
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all }),
    ]);
}

export type PaymentDetails = { paymentId: string; method: PaymentMethod | null; note: string };

/** Member: "I've paid". */
export function useClaimPayment(committeeId: string) {
  const invalidate = useInvalidatePayments(committeeId);
  return useMutation({
    mutationFn: async ({ paymentId, method, note }: PaymentDetails) => {
      const { error } = await supabase.rpc('claim_payment', {
        p_payment_id: paymentId,
        p_method: method ?? undefined,
        p_note: note || undefined,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Organizer: mark paid, or confirm a member's claim. */
export function useConfirmPayment(committeeId: string) {
  const invalidate = useInvalidatePayments(committeeId);
  return useMutation({
    mutationFn: async ({ paymentId, method, note }: PaymentDetails) => {
      const { error } = await supabase.rpc('confirm_payment', {
        p_payment_id: paymentId,
        p_method: method ?? undefined,
        p_note: note || undefined,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRejectClaim(committeeId: string) {
  const invalidate = useInvalidatePayments(committeeId);
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc('reject_payment_claim', { p_payment_id: paymentId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRevertPayment(committeeId: string) {
  const invalidate = useInvalidatePayments(committeeId);
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc('revert_payment', { p_payment_id: paymentId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
