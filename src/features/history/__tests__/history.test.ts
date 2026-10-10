import i18n from '@/i18n';

import { buildHistory, buildShareText, type HistoryCycle, type HistoryPayment } from '../history';

const t = i18n.t.bind(i18n);

const members = [
  { id: 'a', display_name: 'Ayesha', is_former_user: false },
  { id: 'b', display_name: 'Bilal', is_former_user: false },
  { id: 'c', display_name: 'Old', is_former_user: true },
];

const cycles: HistoryCycle[] = [
  {
    id: 'c1',
    cycle_number: 1,
    due_date: '2027-01-05',
    payout_date: '2027-01-10',
    recipient_member_id: 'b',
    payout_status: 'completed',
    payout_completed_at: '2027-01-10T07:00:00Z',
  },
  {
    id: 'c2',
    cycle_number: 2,
    due_date: '2027-02-05',
    payout_date: '2027-02-10',
    recipient_member_id: 'a',
    payout_status: 'pending',
    payout_completed_at: null,
  },
  {
    id: 'c3',
    cycle_number: 3,
    due_date: '2027-03-05',
    payout_date: '2027-03-10',
    recipient_member_id: 'c',
    payout_status: 'pending',
    payout_completed_at: null,
  },
];

function pay(
  cycle: string,
  member: string,
  status: HistoryPayment['status'],
  paidAt: string | null = null,
): HistoryPayment {
  return {
    id: `${cycle}${member}`,
    cycle_id: cycle,
    member_id: member,
    amount: 5000,
    status,
    claimed_at: null,
    paid_at: paidAt,
  };
}

const payments = [
  pay('c1', 'a', 'paid', '2027-01-04T07:00:00Z'),
  pay('c1', 'b', 'paid', '2027-01-05T07:00:00Z'),
  pay('c1', 'c', 'paid', '2027-01-03T07:00:00Z'),
  pay('c2', 'a', 'paid', '2027-02-02T07:00:00Z'),
  pay('c2', 'b', 'pending'),
  pay('c2', 'c', 'awaiting_confirmation'),
  pay('c3', 'a', 'pending'),
];

const base = {
  startMonth: '2027-01-01',
  members,
  cycles,
  payments,
  today: '2027-02-20',
  formerUser: 'Former user',
};

describe('buildHistory', () => {
  it('shows started months, newest first, with late status computed', () => {
    const months = buildHistory({ ...base, filter: { cycleId: null, memberId: null } });
    expect(months.map((m) => m.cycle.id)).toEqual(['c2', 'c1']);
    expect(months[0]?.payments.map((p) => [p.memberName, p.status])).toEqual([
      ['Ayesha', 'paid'],
      ['Bilal', 'late'],
      ['Former user', 'awaiting_confirmation'],
    ]);
    expect(months[0]?.recipientName).toBe('Ayesha');
  });

  it('filters by month (including a future one) and by member', () => {
    expect(
      buildHistory({ ...base, filter: { cycleId: 'c3', memberId: null } }).map((m) => m.cycle.id),
    ).toEqual(['c3']);
    const bilal = buildHistory({ ...base, filter: { cycleId: null, memberId: 'b' } });
    expect(bilal.map((m) => m.payments.map((p) => p.memberName))).toEqual([['Bilal'], ['Bilal']]);
  });
});

describe('buildShareText', () => {
  it('summarises the whole committee for WhatsApp', () => {
    const months = buildHistory({ ...base, filter: { cycleId: null, memberId: null } });
    const text = buildShareText(t, {
      committee: { name: 'Office Kameti', contribution_amount: 5000, member_count: 3 },
      months,
      cycles,
      memberName: null,
    });
    expect(text).toBe(
      [
        'Office Kameti – committee summary',
        'Rs 5,000 a month × 3 members = Rs 15,000 payout',
        'Payouts done: 1 of 3',
        '',
        'January 2027: payout to Bilal – paid out on 10 Jan 2027, 12:00 PM',
        '  Paid: 3 of 3',
        'February 2027: payout to Ayesha – not paid out yet',
        '  Paid: 1 of 3',
        '  Not paid: Bilal, Former user',
        '',
        'Shared from the Kameti app',
      ].join('\n'),
    );
  });

  it("summarises one member's record", () => {
    const months = buildHistory({ ...base, filter: { cycleId: null, memberId: 'b' } });
    const text = buildShareText(t, {
      committee: { name: 'Office Kameti', contribution_amount: 5000, member_count: 3 },
      months,
      cycles,
      memberName: 'Bilal',
    });
    expect(text).toContain(
      "Bilal's payments\nJanuary 2027: Paid (5 Jan 2027, 12:00 PM)\nFebruary 2027: Late",
    );
  });
});
