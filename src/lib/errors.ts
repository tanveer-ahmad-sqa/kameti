import en from '@/i18n/locales/en.json';

type ErrorCode = keyof (typeof en)['errors'];
export type ErrorKey = `errors.${ErrorCode}`;

/**
 * Database business-rule errors (`raise exception using message = '<code>'`) map to
 * `errors.<code>` in en.json. Adding the string is all that's needed for a new code.
 */
function isKnownErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(en.errors, code);
}

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
    error.name === 'FunctionsFetchError' ||
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
  if (code === 'P0001' && isKnownErrorCode(message)) return `errors.${message}`;
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
