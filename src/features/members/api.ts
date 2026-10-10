import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';
import type { MemberFormOutput } from '@shared/schemas/member';

export type Member = Pick<
  Tables<'committee_members'>,
  'id' | 'display_name' | 'phone' | 'user_id' | 'is_organizer' | 'is_former_user' | 'turn_number'
>;

const MEMBER_COLUMNS = 'id, display_name, phone, user_id, is_organizer, is_former_user, turn_number';

export function useMembers(committeeId: string) {
  return useQuery({
    queryKey: queryKeys.members.list(committeeId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('committee_members')
        .select(MEMBER_COLUMNS)
        .eq('committee_id', committeeId)
        .order('is_organizer', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidateMembers(committeeId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.members.list(committeeId) });
}

/** Adds one or more members in a single request (all or nothing). */
export function useAddMembers(committeeId: string) {
  const invalidate = useInvalidateMembers(committeeId);
  return useMutation({
    mutationFn: async (members: MemberFormOutput[]) => {
      const { error } = await supabase.from('committee_members').insert(
        members.map((member) => ({
          committee_id: committeeId,
          display_name: member.displayName,
          phone: member.phone,
        })),
      );
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useUpdateMember(committeeId: string) {
  const invalidate = useInvalidateMembers(committeeId);
  return useMutation({
    mutationFn: async ({ memberId, values }: { memberId: string; values: MemberFormOutput }) => {
      const { data, error } = await supabase
        .from('committee_members')
        .update({ display_name: values.displayName, phone: values.phone })
        .eq('id', memberId)
        .select('id');
      if (error) throw error;
      if (data.length === 0) throw { code: 'P0001', message: 'not_organizer' };
    },
    onSettled: invalidate,
  });
}

export function useRemoveMember(committeeId: string) {
  const invalidate = useInvalidateMembers(committeeId);
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase
        .from('committee_members')
        .delete()
        .eq('id', memberId)
        .select('id');
      if (error) throw error;
      if (data.length === 0) throw { code: 'P0001', message: 'not_organizer' };
    },
    onSettled: invalidate,
  });
}

/** The "I'm also a member" toggle. */
export function useSetOrganizerMembership(committeeId: string) {
  const invalidate = useInvalidateMembers(committeeId);
  return useMutation({
    mutationFn: async (isMember: boolean) => {
      const { error } = await supabase.rpc('set_organizer_membership', {
        p_committee_id: committeeId,
        p_is_member: isMember,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
