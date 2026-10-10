// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
// Keep this file free of platform APIs. Messages are i18n keys.
import { z } from 'zod';

export const PAYOUT_ORDER_METHODS = ['random', 'manual', 'member_choice'] as const;
export type PayoutOrderMethod = (typeof PAYOUT_ORDER_METHODS)[number];

export const COMMITTEE_LIMITS = {
  nameMax: 60,
  descriptionMax: 500,
  contributionMin: 1,
  contributionMax: 10_000_000,
  membersMin: 2,
  membersMax: 50,
  dayMin: 1,
  dayMax: 28,
} as const;

/** Whole rupees typed as text ("10,000", "10000") -> integer. */
const rupeesSchema = z
  .string()
  .trim()
  .min(1, 'validation.amount_required')
  .transform((value, ctx) => {
    const digits = value.replace(/[,\s]/g, '');
    if (!/^\d+$/.test(digits)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.amount_whole_rupees' });
      return z.NEVER;
    }
    const amount = Number(digits);
    if (amount < COMMITTEE_LIMITS.contributionMin || amount > COMMITTEE_LIMITS.contributionMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.amount_range' });
      return z.NEVER;
    }
    return amount;
  });

/** Integer typed as text -> number within [min, max]. */
function intText(min: number, max: number, rangeMessage: string) {
  return z
    .string()
    .trim()
    .min(1, rangeMessage)
    .transform((value, ctx) => {
      if (!/^\d+$/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: rangeMessage });
        return z.NEVER;
      }
      const n = Number(value);
      if (n < min || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: rangeMessage });
        return z.NEVER;
      }
      return n;
    });
}

export const committeeFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'validation.committee_name_required')
      .max(COMMITTEE_LIMITS.nameMax, 'validation.committee_name_too_long'),
    description: z.string().trim().max(COMMITTEE_LIMITS.descriptionMax, 'validation.description_too_long'),
    contributionAmount: rupeesSchema,
    memberCount: intText(
      COMMITTEE_LIMITS.membersMin,
      COMMITTEE_LIMITS.membersMax,
      'validation.member_count_range',
    ),
    /** First day of a month, yyyy-MM-01. */
    startMonth: z.string().regex(/^\d{4}-\d{2}-01$/, 'validation.start_month_required'),
    dueDay: z
      .number()
      .int()
      .min(COMMITTEE_LIMITS.dayMin, 'validation.due_day_range')
      .max(COMMITTEE_LIMITS.dayMax, 'validation.due_day_range'),
    /** Days between the due date and the payout date. 0 = same day. */
    payoutOffsetDays: z.number().int().min(0, 'validation.payout_offset_range'),
    payoutOrderMethod: z.enum(PAYOUT_ORDER_METHODS),
    includeOrganizer: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.dueDay + value.payoutOffsetDays > COMMITTEE_LIMITS.dayMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payoutOffsetDays'],
        message: 'validation.payout_day_after_28',
      });
    }
  });

export type CommitteeFormInput = z.input<typeof committeeFormSchema>;
export type CommitteeFormOutput = z.output<typeof committeeFormSchema>;

/** Payout day of month stored in the database. */
export function payoutDayOf(dueDay: number, payoutOffsetDays: number): number {
  return dueDay + payoutOffsetDays;
}

/** Largest allowed offset for a due day, so the payout stays within day 28. */
export function maxPayoutOffset(dueDay: number): number {
  return COMMITTEE_LIMITS.dayMax - dueDay;
}

/** Default "days after due date" for a new committee: 5, clamped to the 28th. */
export function defaultPayoutOffset(dueDay: number): number {
  return Math.min(5, maxPayoutOffset(dueDay));
}
