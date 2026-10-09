import {
  formatCalendarDate,
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
