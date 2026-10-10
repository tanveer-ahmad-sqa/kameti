import { buildSchedule, type ScheduleCommittee, type ScheduleMember } from '../schedule';

const committee: ScheduleCommittee = {
  status: 'draft',
  start_month: '2026-11-01',
  due_day: 5,
  payout_day: 10,
  contribution_amount: 10000,
  member_count: 3,
};

const members: ScheduleMember[] = [
  { id: 'a', display_name: 'Ayesha', user_id: 'u-a', is_former_user: false, turn_number: 2 },
  { id: 'b', display_name: 'Bilal', user_id: 'u-b', is_former_user: false, turn_number: null },
  { id: 'c', display_name: 'Sana', user_id: null, is_former_user: false, turn_number: 1 },
];

describe('buildSchedule (draft preview)', () => {
  const rows = buildSchedule({ committee, members, cycles: [], userId: 'u-a', today: '2026-12-07' });

  it('has one row per member with dates in each month', () => {
    expect(rows.map((r) => [r.number, r.month, r.dueDate, r.payoutDate])).toEqual([
      [1, '2026-11-01', '2026-11-05', '2026-11-10'],
      [2, '2026-12-01', '2026-12-05', '2026-12-10'],
      [3, '2027-01-01', '2027-01-05', '2027-01-10'],
    ]);
  });

  it('uses current turns and leaves free months empty', () => {
    expect(rows.map((r) => r.recipient?.display_name ?? null)).toEqual(['Sana', 'Ayesha', null]);
  });

  it('pays out the whole pot', () => {
    expect(rows.every((r) => r.amount === 30000)).toBe(true);
  });

  it('highlights the current month, past months and my month', () => {
    expect(rows.map((r) => r.isCurrentMonth)).toEqual([false, true, false]);
    expect(rows.map((r) => r.isPast)).toEqual([true, false, false]);
    expect(rows.map((r) => r.isMine)).toEqual([false, true, false]);
  });
});

describe('buildSchedule (started)', () => {
  it('uses cycles, including swapped recipients and payout status', () => {
    const rows = buildSchedule({
      committee: { ...committee, status: 'active' },
      members,
      cycles: [
        {
          id: 'c1',
          cycle_number: 1,
          due_date: '2026-11-05',
          payout_date: '2026-11-10',
          recipient_member_id: 'b',
          payout_status: 'completed',
          payout_completed_at: '2026-11-10T08:00:00Z',
        },
        {
          id: 'c2',
          cycle_number: 2,
          due_date: '2026-12-05',
          payout_date: '2026-12-10',
          recipient_member_id: 'a',
          payout_status: 'pending',
          payout_completed_at: null,
        },
        {
          id: 'c3',
          cycle_number: 3,
          due_date: '2027-01-05',
          payout_date: '2027-01-10',
          recipient_member_id: 'c',
          payout_status: 'pending',
          payout_completed_at: null,
        },
      ],
      userId: 'u-b',
      today: '2026-12-07',
    });
    expect(rows.map((r) => [r.cycleId, r.recipient?.display_name, r.paidOut])).toEqual([
      ['c1', 'Bilal', true],
      ['c2', 'Ayesha', false],
      ['c3', 'Sana', false],
    ]);
    expect(rows.map((r) => r.isMine)).toEqual([true, false, false]);
  });
});
