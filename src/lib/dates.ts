import { TZDate } from '@date-fns/tz';
import { format, parseISO } from 'date-fns';

/** All dates are shown in Pakistan time. Pakistan has no daylight saving (UTC+5 all year). */
export const APP_TIME_ZONE = 'Asia/Karachi';

/** A timestamp (ISO string from the database, UTC) in Pakistan time. */
export function toKarachi(timestamp: string | Date): TZDate {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  return new TZDate(date, APP_TIME_ZONE);
}

/** Today's calendar date in Pakistan as yyyy-MM-dd (comparable with Postgres `date` columns). */
export function todayInKarachi(now: Date = new Date()): string {
  return format(toKarachi(now), 'yyyy-MM-dd');
}

/**
 * Postgres `date` columns (due dates, start month) are calendar days, not instants.
 * Parse them as a local calendar date so no timezone shift can move them a day.
 */
export function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return new Date(year, month - 1, day);
}

/** "5 Jan 2030" */
export function formatCalendarDate(value: string): string {
  return format(parseCalendarDate(value), 'd MMM yyyy');
}

/** "January 2030" */
export function formatMonth(value: string): string {
  return format(parseCalendarDate(value), 'MMMM yyyy');
}

/** "5 Jan 2030, 3:45 PM" in Pakistan time. */
export function formatTimestamp(timestamp: string | Date): string {
  return format(toKarachi(timestamp), 'd MMM yyyy, h:mm a');
}
