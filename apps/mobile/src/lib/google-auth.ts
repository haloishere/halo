import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin'
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from 'firebase/auth'
import { auth } from './firebase'

export function configureGoogleSignIn(webClientId: string): void {
  GoogleSignin.configure({ webClientId })
}

export async function signInWithGoogle(): Promise<UserCredential | null> {
  await GoogleSignin.hasPlayServices()
  // Sign out first so the account picker always appears.
  // Swallow errors — sign-out failure is harmless (user may not have been signed in).
  await GoogleSignin.signOut().catch((err) => {
    if (__DEV__) console.warn('GoogleSignin.signOut failed (non-critical):', err)
  })
  let response
  try {
    response = await GoogleSignin.signIn()
  } catch (err: unknown) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return null
    }
    throw err
  }

  const idToken = response.data?.idToken
  if (!idToken) {
    if (__DEV__) console.warn('Google Sign-In: no ID token received (user may have cancelled)')
    return null
  }

  const credential = GoogleAuthProvider.credential(idToken)
  return signInWithCredential(auth, credential)
}
