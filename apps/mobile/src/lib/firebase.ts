import { initializeApp, getApps } from 'firebase/app'
// @ts-expect-error — getReactNativePersistence exists at runtime via react-native condition
// but firebase/auth types resolve to the browser typings which omit it
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const firebase = Constants.expoConfig?.extra?.firebase as
  | Record<string, string | undefined>
  | undefined

if (!firebase?.apiKey || !firebase?.projectId || !firebase?.appId) {
  throw new Error(
    'Missing Firebase config in app.config.ts extra.firebase — ensure apiKey, projectId, and appId are set',
  )
}

const firebaseConfig = {
  apiKey: firebase.apiKey,
  authDomain: firebase.authDomain,
  projectId: firebase.projectId,
  storageBucket: firebase.storageBucket,
  messagingSenderId: firebase.messagingSenderId,
  appId: firebase.appId,
}

const isFirstInit = getApps().length === 0
const app = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0]!

// initializeAuth must only be called once; on HMR reload use getAuth
export const auth = isFirstInit
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    })
  : getAuth(app)
