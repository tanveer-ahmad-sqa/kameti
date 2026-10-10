import { render, screen, within } from '@testing-library/react-native';

import type { Committee } from '@/features/committees/api';
import type { Member } from '@/features/members/api';
import type { Payment } from '@/features/payments/api';
import type { Cycle } from '@/features/payout/api';

import { Dashboard } from '../Dashboard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayInKarachi: () => '2027-02-07',
}));

const ORGANIZER = 'u-ayesha';
const BILAL = 'u-bilal';

const committee: Committee = {
  id: 'k1',
  name: 'Office',
  description: null,
  status: 'active',
  contribution_amount: 10000,
  member_count: 3,
  start_month: '2027-01-01',
  due_day: 5,
  payout_day: 10,
  payout_order_method: 'random',
  organizer_id: ORGANIZER,
  activated_at: '2026-12-20T00:00:00Z',
};

function member(id: string, name: string, userId: string | null, turn: number): Member {
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

const members: Member[] = [
  member('a', 'Ayesha', ORGANIZER, 1),
  member('b', 'Bilal', BILAL, 2),
  member('c', 'Sana', null, 3),
];

function cycle(n: number, recipient: string, done: boolean): Cycle {
  return {
    id: `c${n}`,
    cycle_number: n,
    due_date: `2027-0${n}-05`,
    payout_date: `2027-0${n}-10`,
    recipient_member_id: recipient,
    payout_status: done ? 'completed' : 'pending',
    payout_completed_at: done ? `2027-0${n}-10T07:00:00Z` : null,
    payout_note: null,
  };
}

const cycles: Cycle[] = [cycle(1, 'a', true), cycle(2, 'b', false), cycle(3, 'c', false)];

function pay(
  cycleId: string,
  memberId: string,
  status: Payment['status'],
  paidAt: string | null = null,
): Payment {
  return {
    id: `${cycleId}${memberId}`,
    cycle_id: cycleId,
    member_id: memberId,
    amount: 10000,
    status,
    method: null,
    note: null,
    claimed_at: null,
    paid_at: paidAt,
  };
}

const payments: Payment[] = [
  pay('c1', 'a', 'paid', '2027-01-03T07:00:00Z'),
  pay('c1', 'b', 'paid', '2027-01-04T07:00:00Z'),
  pay('c1', 'c', 'paid', '2027-01-05T07:00:00Z'),
  pay('c2', 'a', 'paid', '2027-02-02T07:00:00Z'),
  pay('c2', 'b', 'pending'),
  pay('c2', 'c', 'awaiting_confirmation'),
  pay('c3', 'a', 'pending'),
  pay('c3', 'b', 'pending'),
  pay('c3', 'c', 'pending'),
];

function renderFor(userId: string, status: Committee['status'] = 'active') {
  return render(
    <Dashboard
      committee={{ ...committee, status }}
      members={members}
      cycles={cycles}
      payments={payments}
      userId={userId}
    />,
  );
}

describe('<Dashboard />', () => {
  it('organizer: this month collected vs pending, unpaid members, next payout, progress', async () => {
    await renderFor(ORGANIZER);
    const month = screen.getByTestId('dashboard-month');
    expect(within(month).getByText('This month · February 2027')).toBeOnTheScreen();
    expect(within(month).getByText('Rs 10,000 of Rs 30,000 collected')).toBeOnTheScreen();
    expect(within(month).getByText('Still to collect: Rs 20,000')).toBeOnTheScreen();
    expect(within(month).getByText('1 payment waiting for your confirmation')).toBeOnTheScreen();
    // Bilal is past the due date (5 Feb) and shows as late.
    expect(within(month).getByText('Bilal')).toBeOnTheScreen();
    expect(within(month).getByText('Late')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('dashboard-next-payout')).getByText('Bilal · 10 Feb 2027'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('dashboard-progress')).getByText('1 of 3 payouts done'),
    ).toBeOnTheScreen();
  });

  it('member: amount due with "I\'ve paid", payout month and streak', async () => {
    await renderFor(BILAL);
    const mine = screen.getByTestId('dashboard-my-payment');
    expect(within(mine).getByText('Rs 10,000')).toBeOnTheScreen();
    expect(within(mine).getByText('Due 5 Feb 2027')).toBeOnTheScreen();
    expect(within(mine).getByRole('button', { name: "I've paid" })).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('dashboard-my-payout')).getByText('February 2027 · Rs 30,000'),
    ).toBeOnTheScreen();
    // January was on time, but February is overdue, which breaks the streak.
    expect(
      within(screen.getByTestId('dashboard-streak')).getByText('Pay on time to start a streak'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('dashboard-month')).not.toBeOnTheScreen();
  });

  it('an organizer who is also a member sees both views', async () => {
    await renderFor(ORGANIZER);
    expect(
      within(screen.getByTestId('dashboard-streak')).getByText('2 months paid on time in a row'),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('dashboard-my-payment')).getByText('Paid')).toBeOnTheScreen();
  });

  it('a completed committee says so and hides "I\'ve paid"', async () => {
    await renderFor(BILAL, 'completed');
    expect(
      screen.getByText('This committee is complete. Every payout and payment is done.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "I've paid" })).not.toBeOnTheScreen();
  });
});
