import { z } from 'zod';

// Expo only inlines `process.env.EXPO_PUBLIC_*` when referenced directly like this,
// so each variable must be read explicitly (no destructuring of process.env).
const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  iosAppStoreUrl: process.env.EXPO_PUBLIC_IOS_APP_STORE_URL,
  inviteBaseUrl: process.env.EXPO_PUBLIC_INVITE_BASE_URL,
};

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const envSchema = z.object({
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(1),
  sentryDsn: optionalUrl,
  /** App Store page, once the iOS app is published. Omitted from invites until set. */
  iosAppStoreUrl: optionalUrl,
  /** Future: a web domain for invite links (e.g. https://kameti.pk). Unset in v1. */
  inviteBaseUrl: optionalUrl,
});

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration. Copy .env.example to .env.local and fill it in.\n${parsed.error.message}`,
  );
}

export const env = parsed.data;
