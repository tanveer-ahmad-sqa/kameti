import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { clearQueryCache } from '@/lib/queryClient';
import { setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** False until the persisted session has been read from storage. */
  initialized: boolean;
};

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  initialized: false,
}));

export const useSession = () => useAuthStore((state) => state.session);
export const useUserId = () => useAuthStore((state) => state.session?.user.id ?? null);

/** Subscribes the store to Supabase auth. Returns an unsubscribe function. */
export function startAuthListener(): () => void {
  void supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, initialized: true });
    setSentryUser(data.session?.user.id ?? null);
  });

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ session, initialized: true });
    setSentryUser(session?.user.id ?? null);
    if (event === 'SIGNED_OUT') {
      void clearQueryCache();
    }
  });

  return () => data.subscription.unsubscribe();
}
