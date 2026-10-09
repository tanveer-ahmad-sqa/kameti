import { formatPkMobile, normalizePkMobile, pkMobileSchema } from '@shared/schemas/phone';

describe('normalizePkMobile', () => {
  it.each([
    ['03001234567', '+923001234567'],
    ['0300 1234567', '+923001234567'],
    ['0300-1234567', '+923001234567'],
    ['3001234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['+923001234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['0092 300 1234567', '+923001234567'],
    ['(0345) 1234567', '+923451234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePkMobile(input)).toBe(expected);
  });

  it.each([
    [''],
    ['12345'],
    ['04235555555'], // Lahore landline
    ['+14155552671'], // US number
    ['0300123456'], // too short
    ['030012345678'], // too long
    ['0300abc4567'],
  ])('rejects %s', (input) => {
    expect(normalizePkMobile(input)).toBeNull();
  });
});

describe('formatPkMobile', () => {
  it('formats E.164 the way people in Pakistan write it', () => {
    expect(formatPkMobile('+923001234567')).toBe('0300 1234567');
  });

  it('leaves non-Pakistani numbers unchanged', () => {
    expect(formatPkMobile('+14155552671')).toBe('+14155552671');
  });
});

describe('pkMobileSchema', () => {
  it('outputs E.164', () => {
    expect(pkMobileSchema.parse(' 0300 1234567 ')).toBe('+923001234567');
  });

  it('uses i18n keys as messages', () => {
    expect(pkMobileSchema.safeParse('').error?.issues[0]?.message).toBe('validation.phone_required');
    expect(pkMobileSchema.safeParse('123').error?.issues[0]?.message).toBe('validation.phone_invalid');
  });
});
