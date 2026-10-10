import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

import type { ActivityEntry } from './describe';

const PAGE_SIZE = 30;

/** Newest first, 30 at a time. */
export function useActivity(committeeId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.activity.list(committeeId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, actor_id, action, entity_type, entity_id, payload, created_at')
        .eq('committee_id', committeeId)
        .order('id', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  });
}
