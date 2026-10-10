import {
  addCalendarMonths,
  currentMonthInKarachi,
  formatCalendarDate,
  lastCommitteeMonth,
  upcomingMonths,
  formatMonth,
  formatTimestamp,
  parseCalendarDate,
  todayInKarachi,
} from '../dates';

describe('dates', () => {
  it('uses the Pakistan date even when UTC is still on the previous day', () => {
    // 2030-01-04 20:30 UTC = 2030-01-05 01:30 in Karachi (UTC+5).
    expect(todayInKarachi(new Date('2030-01-04T20:30:00Z'))).toBe('2030-01-05');
  });

  it('formats timestamps in Pakistan time', () => {
    expect(formatTimestamp('2030-01-04T20:30:00Z')).toBe('5 Jan 2030, 1:30 AM');
  });

  it('never shifts calendar dates', () => {
    expect(formatCalendarDate('2030-03-01')).toBe('1 Mar 2030');
    expect(formatMonth('2030-12-01')).toBe('December 2030');
    expect(parseCalendarDate('2030-02-28').getDate()).toBe(28);
  });

  it('rejects malformed calendar dates', () => {
    expect(() => parseCalendarDate('not-a-date')).toThrow(RangeError);
  });
});

describe('month helpers', () => {
  // 2026-12-31 22:00 UTC is already 1 Jan 2027 in Karachi.
  const newYearInKarachi = new Date('2026-12-31T22:00:00Z');

  it('uses the Pakistan month', () => {
    expect(currentMonthInKarachi(newYearInKarachi)).toBe('2027-01-01');
  });

  it('lists upcoming months across a year boundary', () => {
    expect(upcomingMonths(3, new Date('2026-11-15T12:00:00Z'))).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
  });

  it('computes the last month of a committee', () => {
    expect(lastCommitteeMonth('2026-11-01', 10)).toBe('2027-08-01');
    expect(lastCommitteeMonth('2026-11-01', 1)).toBe('2026-11-01');
  });

  it('adds months', () => {
    expect(addCalendarMonths('2027-01-01', 13)).toBe('2028-02-01');
  });
});
