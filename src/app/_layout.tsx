import '@/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui';
import { startAuthListener, useAuthStore } from '@/features/auth/authStore';
import { useProfile } from '@/features/profile/api';
import {
  CACHE_MAX_AGE_MS,
  queryClient,
  queryPersister,
  shouldPersistQuery,
  wireQueryManagers,
} from '@/lib/queryClient';
import { initSentry, Sentry } from '@/lib/sentry';
import { useTheme } from '@/theme/useTheme';

initSentry();
wireQueryManagers();
void SplashScreen.preventAutoHideAsync();

/** Bump when cached query shapes change in a breaking way, to discard old offline caches. */
const CACHE_BUSTER = 'v1';

function RootNavigator() {
  const { initialized, session } = useAuthStore();
  const userId = session?.user.id ?? null;
  const profile = useProfile(userId);

  useEffect(() => startAuthListener(), []);

  const profileResolved = !session || profile.data !== undefined || profile.isError;
  const ready = initialized && profileResolved;
  // Offline on first launch after sign-in, with nothing cached: the query is paused.
  const profileBlocked = Boolean(session) && profile.data === undefined && profile.fetchStatus === 'paused';

  useEffect(() => {
    if (ready || profileBlocked) {
      void SplashScreen.hideAsync();
    }
  }, [ready, profileBlocked]);

  if (profileBlocked || (session && profile.isError && profile.data === undefined)) {
    return (
      <ErrorState
        error={profile.error ?? { message: 'network error' }}
        onRetry={() => void profile.refetch()}
      />
    );
  }

  if (!ready) {
    return null; // Splash screen stays visible.
  }

  const signedIn = Boolean(session);
  const needsProfile = signedIn && !profile.data?.full_name;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const { scheme, colors } = useTheme();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: CACHE_MAX_AGE_MS,
          buster: CACHE_BUSTER,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}
      >
        <ThemeProvider value={navigationTheme}>
          <RootNavigator />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
