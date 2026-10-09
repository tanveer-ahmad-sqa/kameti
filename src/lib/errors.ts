import type en from '@/i18n/locales/en.json';

export type ErrorKey = `errors.${keyof (typeof en)['errors']}`;

/** Stable error codes raised by the database (`raise exception using message = '<code>'`). */
const DB_ERROR_KEYS: Record<string, ErrorKey> = {
  committee_full: 'errors.committee_full',
  committee_not_draft: 'errors.committee_not_draft',
  committee_locked: 'errors.committee_locked',
  turn_out_of_range: 'errors.turn_out_of_range',
};

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
};

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

function isNetworkError(error: ErrorLike): boolean {
  const message = typeof error.message === 'string' ? error.message : '';
  return (
    error.name === 'AuthRetryableFetchError' ||
    /network request failed|failed to fetch|network error|timed out/i.test(message)
  );
}

/** Maps Supabase/Postgres/Auth errors to a translation key the UI can show. */
export function errorKey(error: unknown): ErrorKey {
  const e = asErrorLike(error);
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (isNetworkError(e)) return 'errors.network';

  // Supabase Auth error codes.
  if (code === 'otp_expired' || code === 'invalid_credentials') return 'errors.otp_invalid';
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || e.status === 429) {
    return 'errors.rate_limited';
  }
  if (code === 'sms_send_failed' || code === 'validation_failed') return 'errors.sms_failed';

  // Postgres.
  if (code === 'P0001' && message in DB_ERROR_KEYS) return DB_ERROR_KEYS[message] ?? 'errors.unknown';
  if (code === '23505' && message.includes('committee_members_unique_phone')) return 'errors.duplicate_phone';
  if (code === '42501') return 'errors.not_allowed';

  return 'errors.unknown';
}

/** Network failures and 5xx are worth retrying; permission/validation errors are not. */
export function isRetryableError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (isNetworkError(e)) return true;
  return typeof e.status === 'number' && e.status >= 500;
}
