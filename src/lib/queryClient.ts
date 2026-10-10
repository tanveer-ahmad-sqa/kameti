import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateQuery,
  focusManager,
  onlineManager,
  QueryClient,
  type Query,
} from '@tanstack/react-query';
import { AsyncStorage } from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';

import { isRetryableError } from './errors';

/** Cached data stays viewable offline for a week. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE_MS,
      retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
      // When offline, keep showing cached data instead of erroring.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Writes need a connection; never queue money changes to send later.
      networkMode: 'online',
      retry: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'kameti-query-cache',
  throttleTime: 1000,
});

/** Successful server queries are saved for offline use; on-device data (contacts) never is. */
export function shouldPersistQuery(query: Query): boolean {
  return query.queryKey[0] !== 'device' && defaultShouldDehydrateQuery(query);
}

/** Removes all cached server data (on sign-out, so the next user on this phone sees nothing). */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}

let managersWired = false;

/** Wire TanStack Query to device connectivity and app focus. Call once at startup. */
export function wireQueryManagers(): void {
  if (managersWired) {
    return;
  }
  managersWired = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );

  AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active');
    }
  });
}
