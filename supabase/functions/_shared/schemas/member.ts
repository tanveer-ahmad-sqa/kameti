// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
// Relative imports inside _shared must include the `.ts` extension (required by Deno).
import { z } from 'zod';

import { pkMobileSchema } from './phone.ts';

export const memberFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'validation.member_name_required')
    .max(60, 'validation.name_too_long'),
  phone: pkMobileSchema,
});

export type MemberFormInput = z.input<typeof memberFormSchema>;
export type MemberFormOutput = z.output<typeof memberFormSchema>;
