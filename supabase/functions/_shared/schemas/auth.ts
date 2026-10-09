// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
import { z } from 'zod';

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'validation.otp_invalid');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.name_required')
  .max(60, 'validation.name_too_long');

export const profileSchema = z.object({
  fullName: fullNameSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;
