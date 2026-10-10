import { useTranslation } from 'react-i18next';
import { Alert, Linking, Share } from 'react-native';

import type { Committee } from '@/features/committees/api';
import { env } from '@/lib/env';

import type { Member } from './api';
import { buildInviteMessage, inviteLinks, smsUrl, whatsAppUrl } from './invite';

/** Invite actions for a committee: per-member WhatsApp/SMS, or a general share sheet. */
export function useInvite(committee: Committee | null | undefined, organizerName: string | null) {
  const { t } = useTranslation();

  const message = (member?: Member) => {
    if (!committee) return '';
    return buildInviteMessage(t, {
      committeeName: committee.name,
      contributionAmount: committee.contribution_amount,
      memberCount: committee.member_count,
      organizerName,
      memberName: member?.display_name,
      memberPhone: member?.phone,
      links: inviteLinks(committee.id, env),
    });
  };

  const open = async (url: string, app: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('invite.openFailed', { app }));
    }
  };

  return {
    shareGeneral: () => {
      void Share.share({ message: message() });
    },
    whatsApp: (member: Member) => {
      if (member.phone) void open(whatsAppUrl(member.phone, message(member)), 'WhatsApp');
    },
    sms: (member: Member) => {
      if (member.phone) void open(smsUrl(member.phone, message(member)), 'SMS');
    },
  };
}
