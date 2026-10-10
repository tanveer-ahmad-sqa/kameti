import { render, screen, userEvent, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { Committee } from '@/features/committees/api';
import type { Member } from '@/features/members/api';
import type { Cycle } from '@/features/payout/api';

import type { Payment } from '../api';
import { PaymentsScreen } from '../PaymentsScreen';

const MOCK_ORGANIZER = 'u-ayesha';
const BILAL = 'u-bilal';

let mockUserId = MOCK_ORGANIZER;
let mockStatus: Committee['status'] = 'active';
const mockPush = jest.fn();
const mockRevert = jest.fn();
const mockReject = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => ({ id: 'k1' }),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayInKarachi: () => '2027-02-07',
}));
jest.mock('@/features/auth/authStore', () => ({ useUserId: () => mockUserId }));
jest.mock('../api', () => ({
  useRejectClaim: () => ({ mutate: mockReject, isPending: false, error: null }),
  useRevertPayment: () => ({ mutate: mockRevert, isPending: false, error: null }),
}));

function member(id: string, name: string, userId: string | null): Member {
  return {
    id,
    display_name: name,
    phone: null,
    user_id: userId,
    is_organizer: userId === MOCK_ORGANIZER,
    is_former_user: false,
    turn_number: null,
  };
}

const mockMembers: Member[] = [
  member('a', 'Ayesha', MOCK_ORGANIZER),
  member('b', 'Bilal', BILAL),
  member('c', 'Sana', null),
];
const mockCycles: Cycle[] = [
  {
    id: 'c1',
    cycle_number: 1,
    due_date: '2027-01-05',
    payout_date: '2027-01-10',
    recipient_member_id: 'a',
    payout_status: 'completed',
    payout_completed_at: null,
    payout_note: null,
  },
  {
    id: 'c2',
    cycle_number: 2,
    due_date: '2027-02-05',
    payout_date: '2027-02-10',
    recipient_member_id: 'b',
    payout_status: 'pending',
    payout_completed_at: null,
    payout_note: null,
  },
];

function pay(memberId: string, status: Payment['status'], extra: Partial<Payment> = {}): Payment {
  return {
    id: `c2${memberId}`,
    cycle_id: 'c2',
    member_id: memberId,
    amount: 10000,
    status,
    method: null,
    note: null,
    claimed_at: null,
    paid_at: null,
    ...extra,
  };
}

const mockPayments: Payment[] = [
  pay('a', 'paid', { paid_at: '2027-02-02T07:00:00Z', method: 'easypaisa' }),
  pay('b', 'pending'),
  pay('c', 'awaiting_confirmation', { claimed_at: '2027-02-04T07:00:00Z', note: 'Sent via bank' }),
];

jest.mock('@/features/committees/useCommitteeData', () => ({
  useCommitteeData: () => ({
    committee: {
      id: 'k1',
      name: 'Office',
      description: null,
      status: mockStatus,
      contribution_amount: 10000,
      member_count: 3,
      start_month: '2027-01-01',
      due_day: 5,
      payout_day: 10,
      payout_order_method: 'random',
      organizer_id: MOCK_ORGANIZER,
      activated_at: null,
    },
    members: mockMembers,
    cycles: mockCycles,
    payments: mockPayments,
    started: true,
    ready: true,
    notFound: false,
    error: null,
    refreshing: false,
    refresh: jest.fn(),
  }),
}));

beforeEach(() => {
  mockUserId = MOCK_ORGANIZER;
  mockStatus = 'active';
  jest.clearAllMocks();
});

describe('<PaymentsScreen />', () => {
  it('opens on the current month with collected vs expected', async () => {
    await render(<PaymentsScreen />);
    expect(screen.getByRole('button', { name: /Month: February 2027 \(due 5 Feb 2027\)/ })).toBeOnTheScreen();
    expect(screen.getByText('Rs 10,000 of Rs 30,000 collected')).toBeOnTheScreen();
    expect(screen.getByText('1 payment waiting for your confirmation')).toBeOnTheScreen();
  });

  it('organizer: mark paid, confirm or reject a claim, undo a payment', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    const user = userEvent.setup();
    await render(<PaymentsScreen />);

    // Bilal is past the due date: shown as late with "Mark paid".
    const bilal = screen.getByTestId('payment-b');
    expect(within(bilal).getByText('Late')).toBeOnTheScreen();
    await user.press(within(bilal).getByRole('button', { name: 'Mark paid' }));
    expect(mockPush).toHaveBeenCalledWith('/committee/k1/payment/c2b?mode=mark');

    const sana = screen.getByTestId('payment-c');
    expect(within(sana).getByText('“Sent via bank”')).toBeOnTheScreen();
    await user.press(within(sana).getByRole('button', { name: 'Confirm' }));
    expect(mockPush).toHaveBeenCalledWith('/committee/k1/payment/c2c?mode=confirm');
    await user.press(within(sana).getByRole('button', { name: 'Not received' }));
    expect(mockReject).toHaveBeenCalledWith('c2c');

    const ayesha = screen.getByTestId('payment-a');
    expect(within(ayesha).getByText(/via Easypaisa/)).toBeOnTheScreen();
    await user.press(within(ayesha).getByRole('button', { name: 'Undo' }));
    expect(mockRevert).toHaveBeenCalledWith('c2a');
  });

  it('member: only an "I\'ve paid" button on their own unpaid payment', async () => {
    mockUserId = BILAL;
    const user = userEvent.setup();
    await render(<PaymentsScreen />);
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: "I've paid" }));
    expect(mockPush).toHaveBeenCalledWith('/committee/k1/payment/c2b?mode=claim');
  });

  it('a completed committee is read-only', async () => {
    mockStatus = 'completed';
    await render(<PaymentsScreen />);
    expect(screen.queryByRole('button', { name: /Mark paid|Confirm|Undo|I've paid/ })).not.toBeOnTheScreen();
  });
});
