import { useMutation } from '@tanstack/react-query';

import { clearQueryCache } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

/** Sends an SMS code. `phone` must already be normalized to E.164 (+923XXXXXXXXX). */
export function useSendOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: 'sms' } });
      if (error) throw error;
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
      return data.session;
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      // Clear cached data even if the network call fails, so the next user sees nothing.
      await clearQueryCache();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  });
}
