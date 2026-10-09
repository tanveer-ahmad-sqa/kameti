import { errorKey, isRetryableError } from '../errors';

describe('errorKey', () => {
  it('maps database business-rule errors', () => {
    expect(errorKey({ code: 'P0001', message: 'committee_full' })).toBe('errors.committee_full');
    expect(errorKey({ code: 'P0001', message: 'committee_not_draft' })).toBe('errors.committee_not_draft');
  });

  it('maps duplicate phone in a committee', () => {
    expect(
      errorKey({
        code: '23505',
        message: 'duplicate key value violates unique constraint "committee_members_unique_phone"',
      }),
    ).toBe('errors.duplicate_phone');
  });

  it('maps auth errors', () => {
    expect(errorKey({ code: 'otp_expired', status: 403 })).toBe('errors.otp_invalid');
    expect(errorKey({ code: 'over_sms_send_rate_limit', status: 429 })).toBe('errors.rate_limited');
  });

  it('maps network failures', () => {
    expect(errorKey(new TypeError('Network request failed'))).toBe('errors.network');
  });

  it('falls back to a generic message', () => {
    expect(errorKey('weird')).toBe('errors.unknown');
    expect(errorKey({ code: 'P0001', message: 'something_new' })).toBe('errors.unknown');
  });
});

describe('isRetryableError', () => {
  it('retries network and server errors only', () => {
    expect(isRetryableError(new TypeError('Network request failed'))).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ status: 403 })).toBe(false);
    expect(isRetryableError({ code: '42501' })).toBe(false);
  });
});
