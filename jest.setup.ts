import '@/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }: { children: unknown }) => children,
  Stack: { Screen: () => null },
}));

// Component tests never talk to a real backend.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
