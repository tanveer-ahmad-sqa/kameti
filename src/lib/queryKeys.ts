/** Every TanStack Query key in one place, so invalidation is predictable. */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  committees: {
    all: ['committees'] as const,
    mine: (userId: string) => ['committees', 'mine', userId] as const,
    detail: (committeeId: string) => ['committees', 'detail', committeeId] as const,
    organizerName: (committeeId: string) => ['committees', 'organizerName', committeeId] as const,
  },
  /** On-device data (e.g. contacts). Never persisted to the offline cache. */
  device: {
    contacts: ['device', 'contacts'] as const,
  },
  cycles: {
    list: (committeeId: string) => ['cycles', 'list', committeeId] as const,
  },
  draws: {
    list: (committeeId: string) => ['draws', 'list', committeeId] as const,
  },
  payments: {
    list: (committeeId: string) => ['payments', 'list', committeeId] as const,
  },
  activity: {
    list: (committeeId: string) => ['activity', 'list', committeeId] as const,
  },
  members: {
    all: ['members'] as const,
    list: (committeeId: string) => ['members', 'list', committeeId] as const,
  },
};
