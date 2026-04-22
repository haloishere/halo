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
  slug: 'halo',
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
    bundleIdentifier: 'tech.haloapp.app',
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
    package: 'tech.haloapp.app',
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
      apiKey: 'AIzaSyBS8kzQnGsKBqGhyk_sj53y8R8ga4Cy4p4',
      authDomain: 'halo-27a7f.firebaseapp.com',
      projectId: 'halo-27a7f',
      storageBucket: 'halo-27a7f.firebasestorage.app',
      messagingSenderId: '771453979055',
      appId: '1:771453979055:web:093ca9c9678a9799d6075a',
      measurementId: 'G-1MNR8NR57H',
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    googleWebClientId: '771453979055-cgitipb97normpb6n8coq2b1lqs14uoq.apps.googleusercontent.com',
    router: {},
    eas: {
      projectId: '4da8ab8c-2127-4a37-b7c2-23739545b460',
    },
  },
  owner: 'holda',
}

export default config
