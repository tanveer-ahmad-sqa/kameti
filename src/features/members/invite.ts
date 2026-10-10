import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

import { formatPKR } from '@shared/money';
import { formatPkMobile } from '@shared/schemas/phone';

export const ANDROID_PACKAGE = 'pk.kameti.app';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export type InviteLinks = {
  /** Set once a web domain exists: one https link that opens the app or the right store. */
  webInviteUrl?: string;
  androidUrl: string;
  iosUrl?: string;
};

/**
 * Invite links for a committee. Today: store links. With a domain, a single
 * `${base}/join/${committeeId}` link replaces them, so the message format doesn't change.
 * The app's own deep link is kameti://committee/<id> (handled by Expo Router).
 */
export function inviteLinks(
  committeeId: string,
  config: { inviteBaseUrl?: string; iosAppStoreUrl?: string },
): InviteLinks {
  return {
    webInviteUrl: config.inviteBaseUrl
      ? `${config.inviteBaseUrl.replace(/\/$/, '')}/join/${committeeId}`
      : undefined,
    androidUrl: PLAY_STORE_URL,
    iosUrl: config.iosAppStoreUrl,
  };
}

export type InviteMessageInput = {
  committeeName: string;
  contributionAmount: number;
  memberCount: number;
  organizerName: string | null;
  /** The invited member, when inviting one person. */
  memberName?: string;
  memberPhone?: string | null;
  links: InviteLinks;
};

/** Plain-text invite for WhatsApp/SMS. */
export function buildInviteMessage(t: TFunction, input: InviteMessageInput): string {
  const amount = formatPKR(input.contributionAmount);
  const lines: string[] = [];

  lines.push(input.memberName ? t('invite.greetingNamed', { name: input.memberName }) : t('invite.greeting'));
  lines.push(
    input.organizerName
      ? t('invite.body', {
          organizer: input.organizerName,
          committee: input.committeeName,
          amount,
          count: input.memberCount,
        })
      : t('invite.bodyGeneral', { committee: input.committeeName, amount, count: input.memberCount }),
  );
  lines.push('');
  lines.push(
    input.memberPhone
      ? t('invite.signInWithPhone', { phone: formatPkMobile(input.memberPhone) })
      : t('invite.signIn'),
  );

  if (input.links.webInviteUrl) {
    lines.push(t('invite.link', { url: input.links.webInviteUrl }));
  } else {
    lines.push(t('invite.android', { url: input.links.androidUrl }));
    if (input.links.iosUrl) lines.push(t('invite.ios', { url: input.links.iosUrl }));
  }

  return lines.join('\n');
}

/** wa.me opens the WhatsApp chat with this number, with the message prefilled. */
export function whatsAppUrl(phoneE164: string, message: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
}

/** iOS uses `&body=`, Android `?body=`. */
export function smsUrl(phoneE164: string, message: string, os: string = Platform.OS): string {
  const separator = os === 'ios' ? '&' : '?';
  return `sms:${phoneE164}${separator}body=${encodeURIComponent(message)}`;
}
