// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
// Keep this file free of platform APIs. Relative imports need the `.ts` extension (Deno).
import { z } from 'zod';

/** Pakistani mobile numbers in E.164: +92 3XX XXXXXXX. */
export const PK_MOBILE_E164 = /^\+923\d{9}$/;

/**
 * Accepts common ways people write Pakistani mobiles (from typing or phone contacts):
 * 0300 1234567, 03001234567, 300-1234567, +92 300 1234567, 0092 300 1234567, 92300...
 * Returns E.164 (+923001234567) or null when it is not a valid Pakistani mobile.
 */
export function normalizePkMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  if (digits.startsWith('92')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  const e164 = `+92${digits}`;
  return PK_MOBILE_E164.test(e164) ? e164 : null;
}

/** +923001234567 -> "0300 1234567" (how people in Pakistan read numbers). */
export function formatPkMobile(e164: string): string {
  if (!PK_MOBILE_E164.test(e164)) {
    return e164;
  }
  const local = `0${e164.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4)}`;
}

/** Validates and normalizes to E.164. Error messages are i18n keys. */
export const pkMobileSchema = z
  .string()
  .trim()
  .min(1, 'validation.phone_required')
  .transform((value, ctx) => {
    const normalized = normalizePkMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.phone_invalid' });
      return z.NEVER;
    }
    return normalized;
  });
