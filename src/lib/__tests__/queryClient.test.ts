import type { Query } from '@tanstack/react-query';

import { shouldPersistQuery } from '../queryClient';

jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => ({ AsyncStorage: {} }));

function query(queryKey: readonly unknown[], status: 'success' | 'error' = 'success'): Query {
  return { queryKey, state: { status } } as unknown as Query;
}

describe('shouldPersistQuery', () => {
  it('persists successful server data for offline viewing', () => {
    expect(shouldPersistQuery(query(['committees', 'mine', 'u1']))).toBe(true);
  });

  it('never persists on-device contacts', () => {
    expect(shouldPersistQuery(query(['device', 'contacts']))).toBe(false);
  });

  it('does not persist failed queries', () => {
    expect(shouldPersistQuery(query(['committees', 'mine', 'u1'], 'error'))).toBe(false);
  });
});
