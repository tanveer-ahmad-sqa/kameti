import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { Committee } from '@/features/committees/api';

import type { Member } from '../api';
import { MembersScreen } from '../MembersScreen';

const ORGANIZER_ID = 'user-organizer';
const MEMBER_ID = 'user-bilal';

let mockUserId = ORGANIZER_ID;
let mockCommittee: Committee;
const mockMembers: Member[] = [
  {
    id: 'm1',
    display_name: 'Ayesha',
    phone: '+923001111111',
    user_id: ORGANIZER_ID,
    is_organizer: true,
    is_former_user: false,
    turn_number: null,
  },
  {
    id: 'm2',
    display_name: 'Bilal',
    phone: '+923002222222',
    user_id: MEMBER_ID,
    is_organizer: false,
    is_former_user: false,
    turn_number: null,
  },
  {
    id: 'm3',
    display_name: 'Sana',
    phone: '+923003333333',
    user_id: null,
    is_organizer: false,
    is_former_user: false,
    turn_number: null,
  },
];
const mockRemove = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'c1' }),
}));
jest.mock('@/lib/env', () => ({ env: {} }));
jest.mock('@/features/auth/authStore', () => ({ useUserId: () => mockUserId }));
jest.mock('@/features/committees/api', () => ({
  useCommittee: () => ({ data: mockCommittee, refetch: jest.fn() }),
  useOrganizerName: () => ({ data: 'Ayesha' }),
}));
jest.mock('../api', () => ({
  useMembers: () => ({ data: mockMembers, refetch: jest.fn(), isRefetching: false }),
  useRemoveMember: () => ({ mutate: mockRemove, error: null }),
  useSetOrganizerMembership: () => ({ mutate: jest.fn(), error: null, isPending: false }),
}));

function committee(status: Committee['status']): Committee {
  return {
    id: 'c1',
    name: 'Office Kameti',
    description: null,
    status,
    contribution_amount: 10000,
    member_count: 5,
    start_month: '2030-01-01',
    due_day: 5,
    payout_day: 10,
    payout_order_method: 'random',
    organizer_id: ORGANIZER_ID,
    activated_at: status === 'draft' ? null : '2030-01-01T00:00:00Z',
  };
}

describe('<MembersScreen />', () => {
  beforeEach(() => {
    mockUserId = ORGANIZER_ID;
    mockCommittee = committee('draft');
    mockRemove.mockReset();
  });

  it('organizer in draft: progress, add actions, phones, edit/remove, invites for unjoined members', async () => {
    await render(<MembersScreen />);
    expect(screen.getByText('3 of 5 members added')).toBeOnTheScreen();
    expect(screen.getByText('2 places left')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add from contacts' })).toBeOnTheScreen();
    expect(screen.getByText('0300 3333333')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove Bilal' })).toBeOnTheScreen();
    // Organizer's own row can't be removed here (use the "I'm also a member" switch).
    expect(screen.queryByRole('button', { name: 'Remove Ayesha' })).not.toBeOnTheScreen();
    // Only members who haven't joined get invite buttons.
    expect(screen.getByRole('button', { name: 'Invite Sana on WhatsApp' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Invite Bilal on WhatsApp' })).not.toBeOnTheScreen();
  });

  it('opens WhatsApp with a prefilled personal invite', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const user = userEvent.setup();
    await render(<MembersScreen />);
    await user.press(screen.getByRole('button', { name: 'Invite Sana on WhatsApp' }));
    const url = openURL.mock.calls[0]?.[0] ?? '';
    expect(url.startsWith('https://wa.me/923003333333?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Assalam-o-Alaikum Sana!');
    expect(decodeURIComponent(url)).toContain('0300 3333333');
  });

  it('a regular member sees names and status only', async () => {
    mockUserId = MEMBER_ID;
    await render(<MembersScreen />);
    expect(screen.getByText('Sana')).toBeOnTheScreen();
    expect(screen.queryByText('0300 3333333')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Invite/ })).not.toBeOnTheScreen();
  });

  it('organizer of an active committee: list is locked', async () => {
    mockCommittee = committee('active');
    await render(<MembersScreen />);
    expect(screen.getByText('This committee has started, so the member list is locked.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeOnTheScreen();
  });
});
