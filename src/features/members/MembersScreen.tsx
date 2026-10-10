import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen, SwitchRow } from '@/components/ui';
import { useUserId } from '@/features/auth/authStore';
import { useCommittee, useOrganizerName, type Committee } from '@/features/committees/api';
import { confirm } from '@/lib/confirm';
import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';

import { useMembers, useRemoveMember, useSetOrganizerMembership, type Member } from './api';
import { MemberRow } from './MemberRow';
import { useInvite } from './useInvite';

export function MembersScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const committee = useCommittee(id);
  const members = useMembers(id);

  const refresh = () => {
    void committee.refetch();
    void members.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={members.isRefetching}>
      {committee.data && members.data ? (
        <MemberList committee={committee.data} members={members.data} />
      ) : committee.data === null ? (
        <EmptyState title={t('committee.detail.notFound')} />
      ) : committee.isError || members.isError ? (
        <ErrorState error={committee.error ?? members.error} onRetry={refresh} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function MemberList({ committee, members }: { committee: Committee; members: Member[] }) {
  const { t } = useTranslation();
  const userId = useUserId();
  const organizerName = useOrganizerName(committee.id);
  const remove = useRemoveMember(committee.id);
  const setOrganizerMembership = useSetOrganizerMembership(committee.id);
  const invite = useInvite(committee, organizerName.data ?? null);

  const isOrganizer = committee.organizer_id === userId;
  const canEdit = isOrganizer && committee.status === 'draft';
  const remaining = committee.member_count - members.length;
  const organizerIsMember = members.some((member) => member.is_organizer);
  const mutationError = remove.error ?? setOrganizerMembership.error;

  const onRemove = async (member: Member) => {
    const ok = await confirm({
      title: t('members.removeTitle', { name: member.display_name }),
      message: t('members.removeBody'),
      confirmLabel: t('common.remove'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) remove.mutate(member.id);
  };

  return (
    <>
      <View style={styles.summary}>
        <AppText variant="heading">
          {t('members.progress', { added: members.length, total: committee.member_count })}
        </AppText>
        <AppText tone={remaining > 0 ? 'muted' : 'success'}>
          {remaining > 0 ? t('members.remaining', { count: remaining }) : t('members.full')}
        </AppText>
      </View>

      {!canEdit && committee.status !== 'draft' ? (
        <AppText variant="caption" tone="muted">
          {t('members.lockedNotice')}
        </AppText>
      ) : null}

      {canEdit ? (
        <View style={styles.actions}>
          <SwitchRow
            testID="members-include-me"
            label={t('members.includeMe')}
            hint={t('members.includeMeHint')}
            value={organizerIsMember}
            disabled={setOrganizerMembership.isPending || (!organizerIsMember && remaining <= 0)}
            onValueChange={(value) => setOrganizerMembership.mutate(value)}
          />
          <Button
            testID="members-add"
            label={t('members.add')}
            disabled={remaining <= 0}
            onPress={() => router.push(`/committee/${committee.id}/member-form`)}
          />
          <Button
            testID="members-add-contacts"
            variant="secondary"
            label={t('members.addFromContacts')}
            disabled={remaining <= 0}
            onPress={() => router.push(`/committee/${committee.id}/contacts`)}
          />
        </View>
      ) : null}

      {isOrganizer ? (
        <Button variant="secondary" label={t('members.shareInvite')} onPress={invite.shareGeneral} />
      ) : null}

      {mutationError ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(errorKey(mutationError))}
        </AppText>
      ) : null}

      {members.length === 0 ? (
        <EmptyState title={t('members.emptyTitle')} body={t('members.emptyBody')} />
      ) : (
        <View style={styles.list}>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              showContact={isOrganizer}
              editable={canEdit && !member.is_organizer}
              onEdit={() => router.push(`/committee/${committee.id}/member-form?memberId=${member.id}`)}
              onRemove={() => void onRemove(member)}
              onWhatsApp={() => invite.whatsApp(member)}
              onSms={() => invite.sms(member)}
            />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
});
