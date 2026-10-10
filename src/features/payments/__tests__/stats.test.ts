import {
  currentCycle,
  effectiveStatus,
  monthSummary,
  overallProgress,
  paidOnDay,
  paymentStreak,
  type StatsCycle,
  type StatsPayment,
} from '../stats';

const cycles: StatsCycle[] = [1, 2, 3, 4].map((n) => ({
  id: `c${n}`,
  cycle_number: n,
  due_date: `2027-0${n}-05`,
  payout_date: `2027-0${n}-10`,
  recipient_member_id: `m${n}`,
  payout_status: n === 1 ? 'completed' : 'pending',
}));

function pay(
  cycle: number,
  member: string,
  status: StatsPayment['status'],
  times: { claimed?: string; paid?: string } = {},
): StatsPayment {
  return {
    id: `p${cycle}${member}`,
    cycle_id: `c${cycle}`,
    member_id: member,
    amount: 10000,
    status,
    claimed_at: times.claimed ?? null,
    paid_at: times.paid ?? null,
  };
}

describe('effectiveStatus', () => {
  it('shows late as soon as the due date has passed', () => {
    expect(effectiveStatus('pending', '2027-01-05', '2027-01-06')).toBe('late');
    expect(effectiveStatus('pending', '2027-01-05', '2027-01-05')).toBe('pending');
    expect(effectiveStatus('awaiting_confirmation', '2027-01-05', '2027-01-09')).toBe(
      'awaiting_confirmation',
    );
  });
});

describe('currentCycle', () => {
  it('is this month, else the next one, else the last', () => {
    expect(currentCycle(cycles, '2027-02-20')?.id).toBe('c2');
    expect(currentCycle(cycles, '2026-11-01')?.id).toBe('c1');
    expect(currentCycle(cycles, '2027-09-01')?.id).toBe('c4');
  });
});

describe('monthSummary', () => {
  it('counts only confirmed money as collected', () => {
    const summary = monthSummary(
      [
        pay(1, 'a', 'paid', { paid: '2027-01-04T10:00:00Z' }),
        pay(1, 'b', 'awaiting_confirmation'),
        pay(1, 'c', 'late'),
        pay(2, 'a', 'paid'),
      ],
      'c1',
    );
    expect(summary).toEqual({
      expected: 30000,
      collected: 10000,
      outstanding: 20000,
      paidCount: 1,
      awaitingCount: 1,
      total: 3,
      unpaidMemberIds: ['b', 'c'],
    });
  });
});

describe('paidOnDay', () => {
  it('uses the claim time when a claim was confirmed, in Pakistan time', () => {
    // Claimed 4 Jan 21:00 UTC = 5 Jan 02:00 Karachi; confirmed days later.
    expect(
      paidOnDay(pay(1, 'a', 'paid', { claimed: '2027-01-04T21:00:00Z', paid: '2027-01-09T09:00:00Z' })),
    ).toBe('2027-01-05');
    expect(paidOnDay(pay(1, 'a', 'paid', { paid: '2027-01-03T09:00:00Z' }))).toBe('2027-01-03');
    expect(paidOnDay(pay(1, 'a', 'awaiting_confirmation', { claimed: '2027-01-03T09:00:00Z' }))).toBeNull();
  });
});

describe('paymentStreak', () => {
  const onTime = (cycle: number) => pay(cycle, 'a', 'paid', { paid: `2027-0${cycle}-04T09:00:00Z` });

  it('counts consecutive on-time months back from the latest due month', () => {
    const payments = [onTime(1), onTime(2), onTime(3)];
    expect(paymentStreak('a', payments, cycles, '2027-03-20')).toBe(3);
  });

  it('a late payment breaks the streak', () => {
    const payments = [onTime(1), pay(2, 'a', 'paid', { paid: '2027-02-08T09:00:00Z' }), onTime(3)];
    expect(paymentStreak('a', payments, cycles, '2027-03-20')).toBe(1);
  });

  it('a claim made on time counts even if confirmed later', () => {
    const payments = [
      onTime(1),
      pay(2, 'a', 'paid', { claimed: '2027-02-05T08:00:00Z', paid: '2027-02-12T09:00:00Z' }),
    ];
    expect(paymentStreak('a', payments, cycles, '2027-02-20')).toBe(2);
  });

  it('an unpaid month that is due today does not break the streak yet', () => {
    const payments = [onTime(1), onTime(2), pay(3, 'a', 'pending')];
    expect(paymentStreak('a', payments, cycles, '2027-03-05')).toBe(2);
    expect(paymentStreak('a', payments, cycles, '2027-03-06')).toBe(0);
  });

  it('is zero before anything is due', () => {
    expect(paymentStreak('a', [], cycles, '2026-12-01')).toBe(0);
  });
});

describe('overallProgress', () => {
  it('summarises payouts and payments', () => {
    expect(overallProgress([pay(1, 'a', 'paid'), pay(1, 'b', 'late')], cycles)).toEqual({
      payoutsDone: 1,
      payoutsTotal: 4,
      paymentsPaid: 1,
      paymentsTotal: 2,
      collectedTotal: 10000,
    });
  });
});
