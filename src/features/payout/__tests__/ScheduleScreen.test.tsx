import { render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { Committee } from '@/features/committees/api';
import type { Member } from '@/features/members/api';

import type { Cycle } from '../api';
import { ScheduleScreen } from '../ScheduleScreen';

const ORGANIZER = 'user-organizer';
const BILAL = 'user-bilal';

let mockUserId = ORGANIZER;
let mockCommittee: Committee;
const mockComplete = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'c1' }),
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayInKarachi: () => '2030-02-07',
}));
jest.mock('@/features/auth/authStore', () => ({ useUserId: () => mockUserId }));
jest.mock('@/features/committees/api', () => ({
  useCommittee: () => ({ data: mockCommittee, refetch: jest.fn() }),
}));

const mockMembers: Member[] = [
  {
    id: 'a',
    display_name: 'Ayesha',
    phone: null,
    user_id: ORGANIZER,
    is_organizer: true,
    is_former_user: false,
    turn_number: 1,
  },
  {
    id: 'b',
    display_name: 'Bilal',
    phone: null,
    user_id: BILAL,
    is_organizer: false,
    is_former_user: false,
    turn_number: 2,
  },
  {
    id: 'c',
    display_name: 'Sana',
    phone: null,
    user_id: null,
    is_organizer: false,
    is_former_user: false,
    turn_number: 3,
  },
];
const mockCycles: Cycle[] = [
  {
    id: 'c-1',
    cycle_number: 1,
    due_date: '2030-01-05',
    payout_date: '2030-01-10',
    recipient_member_id: 'a',
    payout_status: 'completed',
    payout_completed_at: '2030-01-10T07:00:00Z',
    payout_note: null,
  },
  {
    id: 'c-2',
    cycle_number: 2,
    due_date: '2030-02-05',
    payout_date: '2030-02-10',
    recipient_member_id: 'b',
    payout_status: 'pending',
    payout_completed_at: null,
    payout_note: null,
  },
  {
    id: 'c-3',
    cycle_number: 3,
    due_date: '2030-03-05',
    payout_date: '2030-03-10',
    recipient_member_id: 'c',
    payout_status: 'pending',
    payout_completed_at: null,
    payout_note: null,
  },
];

jest.mock('@/features/members/api', () => ({
  useMembers: () => ({ data: mockMembers, refetch: jest.fn(), isRefetching: false }),
}));
jest.mock('../api', () => ({
  useCycles: () => ({ data: mockCycles, refetch: jest.fn(), isRefetching: false }),
  useCompletePayout: () => ({ mutate: mockComplete, isPending: false, error: null }),
  useRevertPayout: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));

const activeCommittee: Committee = {
  id: 'c1',
  name: 'Office',
  description: null,
  status: 'active',
  contribution_amount: 10000,
  member_count: 3,
  start_month: '2030-01-01',
  due_day: 5,
  payout_day: 10,
  payout_order_method: 'random',
  organizer_id: ORGANIZER,
  activated_at: '2029-12-20T00:00:00Z',
};

beforeEach(() => {
  mockUserId = ORGANIZER;
  mockCommittee = activeCommittee;
  jest.clearAllMocks();
});

describe('<ScheduleScreen />', () => {
  it('lists every month with recipient, pot and status', async () => {
    await render(<ScheduleScreen />);
    expect(screen.getByText('1 of 3 payouts done')).toBeOnTheScreen();
    expect(screen.getAllByText('Rs 30,000')).toHaveLength(3);
    expect(screen.getByText('To Bilal')).toBeOnTheScreen();
    expect(screen.getByText('Paid out')).toBeOnTheScreen();
    expect(screen.getByText('Payments due 5 Feb 2030 · Payout on 10 Feb 2030')).toBeOnTheScreen();
  });

  it("highlights this month and the user's own payout", async () => {
    mockUserId = BILAL;
    await render(<ScheduleScreen />);
    expect(
      screen.getByLabelText(/February 2030, Bilal, Rs 30,000, Upcoming, This month, Your payout/),
    ).toBeOnTheScreen();
  });

  it('lets the organizer mark a payout as done after confirming', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    const user = userEvent.setup();
    await render(<ScheduleScreen />);
    await user.press(screen.getByTestId('schedule-complete-2'));
    expect(mockComplete).toHaveBeenCalledWith('c-2');
  });

  it('members cannot mark payouts', async () => {
    mockUserId = BILAL;
    await render(<ScheduleScreen />);
    expect(screen.queryByRole('button', { name: 'Mark as paid out' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeOnTheScreen();
  });

  it('drafts show a preview notice', async () => {
    mockCommittee = { ...activeCommittee, status: 'draft' };
    await render(<ScheduleScreen />);
    expect(screen.getByText("Preview. The order isn't final until the committee starts.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mark as paid out' })).not.toBeOnTheScreen();
  });
});
