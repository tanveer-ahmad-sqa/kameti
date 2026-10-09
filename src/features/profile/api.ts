import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

export type Profile = Pick<Tables<'profiles'>, 'id' | 'phone' | 'full_name' | 'reminders_enabled' | 'locale'>;

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, full_name, reminders_enabled, locale')
        .eq('id', userId ?? '')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fullName: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: input.fullName })
        .eq('id', userId)
        .select('id, phone, full_name, reminders_enabled, locale')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(userId), profile);
    },
  });
}
