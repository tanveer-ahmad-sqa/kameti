import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Mirrors TanStack Query's online state (driven by NetInfo in queryClient.ts). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
  );
}
