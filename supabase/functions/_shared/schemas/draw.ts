// Shared between the app (via the `@shared/*` path alias) and Deno edge functions.
import { z } from 'zod';

export const drawRequestSchema = z.object({
  committeeId: z.string().uuid(),
});

export type DrawRequest = z.infer<typeof drawRequestSchema>;

export type DrawResponse = {
  order: { turn_number: number; member_id: string; display_name: string }[];
};
