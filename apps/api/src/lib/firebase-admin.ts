import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

let _authInstance: Auth | null = null

function initFirebase(): Auth {
  if (_authInstance) return _authInstance

  if (getApps().length > 0) {
    _authInstance = getAuth()
    return _authInstance
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID

  if (serviceAccountKey) {
    // Explicit service account key (local dev or non-GCP environments)
    let serviceAccount: object
    try {
      serviceAccount = JSON.parse(serviceAccountKey)
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. ' +
          'Ensure the env var contains the raw JSON string from the Firebase console. ' +
          `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) })
  } else if (firebaseProjectId) {
    // Application Default Credentials with cross-project Firebase ID (GCP environments).
    // serviceAccountId tells firebase-admin to sign custom tokens as the Firebase project's
    // admin SDK SA, avoiding auth/custom-token-mismatch when Cloud Run SA is in a different project.
    const serviceAccountId =
      process.env.FIREBASE_SERVICE_ACCOUNT_ID ??
      `firebase-adminsdk-fbsvc@${firebaseProjectId}.iam.gserviceaccount.com`
    let credential: ReturnType<typeof applicationDefault>
    try {
      credential = applicationDefault()
    } catch (err) {
      throw new Error(
        `Failed to obtain Application Default Credentials for Firebase project "${firebaseProjectId}". ` +
          'Ensure the Cloud Run service account has roles/firebaseauth.admin on the Firebase project. ' +
          `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    initializeApp({ credential, projectId: firebaseProjectId, serviceAccountId })
  } else {
    throw new Error(
      'Firebase Admin requires either FIREBASE_SERVICE_ACCOUNT_KEY (JSON string) ' +
        'or FIREBASE_PROJECT_ID (for ADC on GCP). Set one in the environment.',
    )
  }

  _authInstance = getAuth()
  return _authInstance
}

export function getFirebaseAuth(): Auth {
  return initFirebase()
}

/** @deprecated Use getFirebaseAuth() for lazy initialization. Kept for backward compat. */
export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    return Reflect.get(initFirebase(), prop, receiver)
  },
})
