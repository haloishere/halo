import type { ExpoConfig } from 'expo/config'

/**
 * Dynamic Expo configuration — replaces app.json.
 *
 * Firebase client config is intentionally hardcoded here. These values are
 * public by design (embedded in every mobile binary). The security boundary
 * is Firebase Security Rules, not these credentials.
 *
 * API URL is set per EAS build profile in eas.json via EXPO_PUBLIC_API_URL.
 *
 * Values prefixed with `REPLACE_ME_` must be filled in before first build.
 * See CONFIGURE.md at repo root for provisioning steps.
 */
const config: ExpoConfig = {
  name: 'Halo',
  slug: 'halov1',
  version: '0.0.1',
  scheme: 'halo',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFF8F0',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.halo.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFF8F0',
    },
    edgeToEdgeEnabled: true,
    package: 'com.halo.app',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    '@react-native-google-signin/google-signin',
    [
      'expo-image-picker',
      {
        photosPermission: 'Halo needs access to your photos.',
      },
    ],
    [
      'react-native-edge-to-edge',
      {
        android: {
          parentTheme: 'Light',
          enforceNavigationBarContrast: false,
        },
      },
    ],
  ],
  extra: {
    firebase: {
      apiKey: 'REPLACE_ME_FIREBASE_API_KEY',
      authDomain: 'REPLACE_ME_FIREBASE_PROJECT_ID.firebaseapp.com',
      projectId: 'REPLACE_ME_FIREBASE_PROJECT_ID',
      storageBucket: 'REPLACE_ME_FIREBASE_PROJECT_ID.firebasestorage.app',
      messagingSenderId: 'REPLACE_ME_FIREBASE_MESSAGING_SENDER_ID',
      appId: 'REPLACE_ME_FIREBASE_APP_ID',
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    googleWebClientId: 'REPLACE_ME_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
    router: {},
    eas: {
      projectId: 'REPLACE_ME_EAS_PROJECT_ID',
    },
  },
  owner: 'haloishere',
}

export default config
