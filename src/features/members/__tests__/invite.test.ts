import i18n from '@/i18n';

import { buildInviteMessage, inviteLinks, PLAY_STORE_URL, smsUrl, whatsAppUrl } from '../invite';

const t = i18n.t.bind(i18n);

const base = {
  committeeName: 'Office Kameti',
  contributionAmount: 10000,
  memberCount: 10,
  organizerName: 'Ayesha',
};

describe('inviteLinks', () => {
  it('uses store links when there is no domain', () => {
    expect(inviteLinks('abc', {})).toEqual({
      webInviteUrl: undefined,
      androidUrl: PLAY_STORE_URL,
      iosUrl: undefined,
    });
  });

  it('builds a web link once a domain is configured', () => {
    expect(inviteLinks('abc', { inviteBaseUrl: 'https://kameti.pk/' }).webInviteUrl).toBe(
      'https://kameti.pk/join/abc',
    );
  });
});

describe('buildInviteMessage', () => {
  it('personal invite: name, organizer, terms, phone and store link', () => {
    const message = buildInviteMessage(t, {
      ...base,
      memberName: 'Bilal',
      memberPhone: '+923002222222',
      links: inviteLinks('abc', {}),
    });
    expect(message).toContain('Assalam-o-Alaikum Bilal!');
    expect(message).toContain(
      'Ayesha has added you to the committee "Office Kameti" (Rs 10,000 a month, 10 members)',
    );
    expect(message).toContain('sign in with your number 0300 2222222');
    expect(message).toContain(`Android: ${PLAY_STORE_URL}`);
    expect(message).not.toContain('iPhone:');
  });

  it('general invite without a specific person', () => {
    const message = buildInviteMessage(t, {
      ...base,
      links: inviteLinks('abc', { iosAppStoreUrl: 'https://apps.apple.com/app/id1' }),
    });
    expect(message).toContain('Assalam-o-Alaikum!');
    expect(message).toContain('sign in with the mobile number the organizer added');
    expect(message).toContain('iPhone: https://apps.apple.com/app/id1');
  });

  it('uses only the web link when available', () => {
    const message = buildInviteMessage(t, {
      ...base,
      links: inviteLinks('abc', { inviteBaseUrl: 'https://kameti.pk' }),
    });
    expect(message).toContain('https://kameti.pk/join/abc');
    expect(message).not.toContain('Android:');
  });
});

describe('share URLs', () => {
  it('builds a WhatsApp link without the plus sign', () => {
    expect(whatsAppUrl('+923002222222', 'Hi there')).toBe('https://wa.me/923002222222?text=Hi%20there');
  });

  it('builds SMS links per platform', () => {
    expect(smsUrl('+923002222222', 'Hi', 'ios')).toBe('sms:+923002222222&body=Hi');
    expect(smsUrl('+923002222222', 'Hi', 'android')).toBe('sms:+923002222222?body=Hi');
  });
});
