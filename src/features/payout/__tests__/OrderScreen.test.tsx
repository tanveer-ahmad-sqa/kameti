import { render, screen, userEvent, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { Committee } from '@/features/committees/api';
import type { Member } from '@/features/members/api';

import { OrderScreen } from '../OrderScreen';

const ORGANIZER = 'user-organizer';
const BILAL = 'user-bilal';

let mockUserId = ORGANIZER;
let mockCommittee: Committee;
let mockMembers: Member[];
const mockRunDraw = jest.fn();
const mockSaveOrder = jest.fn();
const mockChoose = jest.fn();
const mockAssign = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'c1' }) }));
jest.mock('@/features/auth/authStore', () => ({ useUserId: () => mockUserId }));
jest.mock('@/features/committees/api', () => ({
  useCommittee: () => ({ data: mockCommittee, refetch: jest.fn() }),
}));
jest.mock('@/features/members/api', () => ({
  useMembers: () => ({ data: mockMembers, refetch: jest.fn(), isRefetching: false }),
}));
jest.mock('../api', () => ({
  useDraws: () => ({ data: [{ id: 'd1', created_at: '2026-10-10T10:00:00Z', result: [] }] }),
  useRunDraw: () => ({ mutate: mockRunDraw, isPending: false, isError: false }),
  useSetPayoutOrder: () => ({ mutate: mockSaveOrder, isPending: false, isError: false }),
  useChooseTurn: () => ({ mutate: mockChoose, isPending: false, error: null }),
  useAssignTurn: () => ({ mutateAsync: mockAssign, error: null }),
}));

function member(id: string, name: string, userId: string | null, turn: number | null): Member {
  return {
    id,
    display_name: name,
    phone: null,
    user_id: userId,
    is_organizer: userId === ORGANIZER,
    is_former_user: false,
    turn_number: turn,
  };
}

function committee(
  method: Committee['payout_order_method'],
  status: Committee['status'] = 'draft',
): Committee {
  return {
    id: 'c1',
    name: 'Office',
    description: null,
    status,
    contribution_amount: 10000,
    member_count: 3,
    start_month: '2030-01-01',
    due_day: 5,
    payout_day: 10,
    payout_order_method: method,
    organizer_id: ORGANIZER,
    activated_at: null,
  };
}

beforeEach(() => {
  mockUserId = ORGANIZER;
  jest.clearAllMocks();
});

describe('random draw', () => {
  it('asks for confirmation, mentions that re-draws are visible, then draws', async () => {
    mockCommittee = committee('random');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 2),
      member('b', 'Bilal', BILAL, 1),
      member('c', 'Sana', null, 3),
    ];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<OrderScreen />);

    expect(screen.getByText('Draw 1 · 10 Oct 2026, 3:00 PM')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Draw again' }));
    expect(alert).toHaveBeenCalledWith(
      'Draw again?',
      'The earlier draw stays in the history, and members can see that you drew again.',
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockRunDraw).toHaveBeenCalled();
  });

  it('cannot draw until every member is added', async () => {
    mockCommittee = committee('random');
    mockMembers = [member('a', 'Ayesha', ORGANIZER, null)];
    await render(<OrderScreen />);
    expect(screen.getByText('Add 2 more members before setting the order.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Draw again' })).toBeDisabled();
  });
});

describe('manual order', () => {
  it('moves members and saves the new order', async () => {
    mockCommittee = committee('manual');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 1),
      member('b', 'Bilal', BILAL, 2),
      member('c', 'Sana', null, 3),
    ];
    const user = userEvent.setup();
    await render(<OrderScreen />);

    expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Ayesha earlier' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Move Sana earlier' }));
    expect(screen.getByText('You have unsaved changes.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Save order' }));
    expect(mockSaveOrder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });
});

describe('members choose', () => {
  it('a member sees free months and can take one', async () => {
    mockUserId = BILAL;
    mockCommittee = committee('member_choice');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 1),
      member('b', 'Bilal', BILAL, null),
      member('c', 'Sana', null, null),
    ];
    const user = userEvent.setup();
    await render(<OrderScreen />);

    expect(screen.getByText('2 months are still free')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Take this month' })).toHaveLength(2);
    await user.press(screen.getAllByRole('button', { name: 'Take this month' })[0]!);
    expect(mockChoose).toHaveBeenCalledWith(2);
  });

  it('a member can give up their own month', async () => {
    mockUserId = BILAL;
    mockCommittee = committee('member_choice');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 1),
      member('b', 'Bilal', BILAL, 3),
      member('c', 'Sana', null, null),
    ];
    const user = userEvent.setup();
    await render(<OrderScreen />);
    expect(screen.getByText('Bilal (You)')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Give up this month' }));
    expect(mockChoose).toHaveBeenCalledWith(null);
  });

  it('the organizer reassigns a taken month by freeing it first', async () => {
    mockCommittee = committee('member_choice');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 1),
      member('b', 'Bilal', BILAL, null),
      member('c', 'Sana', null, null),
    ];
    const user = userEvent.setup();
    await render(<OrderScreen />);

    await user.press(screen.getByTestId('order-assign-1'));
    await user.press(screen.getByRole('radio', { name: 'Bilal' }));
    expect(mockAssign).toHaveBeenNthCalledWith(1, { memberId: 'a', turn: null });
    expect(mockAssign).toHaveBeenNthCalledWith(2, { memberId: 'b', turn: 1 });
  });
});

describe('after the committee starts', () => {
  it('shows a locked, read-only order', async () => {
    mockCommittee = committee('member_choice', 'active');
    mockMembers = [
      member('a', 'Ayesha', ORGANIZER, 1),
      member('b', 'Bilal', BILAL, 2),
      member('c', 'Sana', null, 3),
    ];
    await render(<OrderScreen />);
    expect(screen.getByText('The committee has started, so the order is locked.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Take this month|Give up/ })).not.toBeOnTheScreen();
    expect(
      within(screen.getByLabelText('Month 2 · February 2030: Bilal')).getByText('Bilal'),
    ).toBeOnTheScreen();
  });
});
