import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { env } from './env';

export function initSentry(): void {
  if (!env.sentryDsn) {
    return;
  }
  Sentry.init({
    dsn: env.sentryDsn,
    environment: String(Constants.expoConfig?.extra?.variant ?? 'development'),
    // Never send phone numbers or other personal data by default.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    enabled: !__DEV__,
  });
}

/** Attach only the opaque user id (never phone or name). */
export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
