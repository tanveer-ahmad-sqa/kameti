/** Every TanStack Query key in one place, so invalidation is predictable. */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  committees: {
    all: ['committees'] as const,
    mine: (userId: string) => ['committees', 'mine', userId] as const,
  },
};
