import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * APP_VARIANT is set per EAS build profile (see eas.json) so dev, preview and production builds
 * can be installed side by side with different identifiers and names.
 */
type Variant = 'development' | 'preview' | 'production';

const variant: Variant =
  process.env.APP_VARIANT === 'development' || process.env.APP_VARIANT === 'preview'
    ? process.env.APP_VARIANT
    : 'production';

const BASE_ID = 'pk.kameti.app';

const identifier: Record<Variant, string> = {
  development: `${BASE_ID}.dev`,
  preview: `${BASE_ID}.preview`,
  production: BASE_ID,
};

const appName: Record<Variant, string> = {
  development: 'Kameti (Dev)',
  preview: 'Kameti (Preview)',
  production: 'Kameti',
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName[variant],
  slug: 'kameti',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'kameti',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: identifier[variant],
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: identifier[variant],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Kameti only reads contacts (to add members); it never writes them.
    blockedPermissions: ['android.permission.WRITE_CONTACTS'],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0F766E',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-sqlite',
    'expo-localization',
    [
      'expo-contacts',
      {
        contactsPermission:
          'Kameti uses your contacts only when you choose to add committee members from them. Contacts are never uploaded.',
      },
    ],
    [
      '@sentry/react-native',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
