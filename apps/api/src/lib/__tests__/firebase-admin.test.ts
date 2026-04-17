import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Reset module registry and mocks between tests
beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  cert: vi.fn((sa) => sa),
  applicationDefault: vi.fn(() => ({ type: 'authorized_user' })),
}))

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
  })),
}))

describe('firebase-admin', () => {
  it('getFirebaseAuth() throws when neither FIREBASE_SERVICE_ACCOUNT_KEY nor FIREBASE_PROJECT_ID is set', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '')
    vi.stubEnv('FIREBASE_PROJECT_ID', '')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    expect(() => getFirebaseAuth()).toThrow(
      'Firebase Admin requires either FIREBASE_SERVICE_ACCOUNT_KEY',
    )
  })

  it('getFirebaseAuth() calls applicationDefault() and passes credential when using ADC', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '')
    vi.stubEnv('FIREBASE_PROJECT_ID', 'my-firebase-project')
    const { initializeApp, applicationDefault } = await import('firebase-admin/app')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    getFirebaseAuth()
    expect(applicationDefault).toHaveBeenCalledOnce()
    expect(initializeApp).toHaveBeenCalledWith({
      credential: { type: 'authorized_user' },
      projectId: 'my-firebase-project',
      serviceAccountId: 'firebase-adminsdk-fbsvc@my-firebase-project.iam.gserviceaccount.com',
    })
  })

  it('getFirebaseAuth() uses FIREBASE_SERVICE_ACCOUNT_ID override when set', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '')
    vi.stubEnv('FIREBASE_PROJECT_ID', 'my-firebase-project')
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_ID', 'custom-sa@other-project.iam.gserviceaccount.com')
    const { initializeApp } = await import('firebase-admin/app')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    getFirebaseAuth()
    expect(initializeApp).toHaveBeenCalledWith({
      credential: { type: 'authorized_user' },
      projectId: 'my-firebase-project',
      serviceAccountId: 'custom-sa@other-project.iam.gserviceaccount.com',
    })
  })

  it('getFirebaseAuth() throws descriptive error when applicationDefault() fails', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '')
    vi.stubEnv('FIREBASE_PROJECT_ID', 'my-firebase-project')
    const { applicationDefault } = await import('firebase-admin/app')
    vi.mocked(applicationDefault).mockImplementation(() => {
      throw new Error('Could not load the default credentials')
    })
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    expect(() => getFirebaseAuth()).toThrow(
      /Failed to obtain Application Default Credentials.*my-firebase-project/,
    )
    expect(() => getFirebaseAuth()).toThrow(/Could not load the default credentials/)
  })

  it('getFirebaseAuth() throws on malformed JSON in FIREBASE_SERVICE_ACCOUNT_KEY', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', 'not-valid-json')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    expect(() => getFirebaseAuth()).toThrow('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON')
  })

  it('getFirebaseAuth() includes parse error details in malformed JSON error', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '{bad json')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    expect(() => getFirebaseAuth()).toThrow(/Parse error:/)
  })

  it('getFirebaseAuth() prefers service account key when both env vars are set', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', JSON.stringify({ project_id: 'from-key' }))
    vi.stubEnv('FIREBASE_PROJECT_ID', 'from-adc')
    const { cert, applicationDefault } = await import('firebase-admin/app')
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    getFirebaseAuth()
    expect(cert).toHaveBeenCalled()
    expect(applicationDefault).not.toHaveBeenCalled()
  })

  it('getFirebaseAuth() reuses existing app when getApps() returns non-empty', async () => {
    const { getApps, initializeApp } = await import('firebase-admin/app')
    vi.mocked(getApps).mockReturnValueOnce([{} as never])
    const { getFirebaseAuth } = await import('../firebase-admin.js')
    getFirebaseAuth()
    expect(initializeApp).not.toHaveBeenCalled()
  })

  it('exports firebaseAuth proxy with expected interface when credentials are valid', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', JSON.stringify({ project_id: 'test' }))
    const { firebaseAuth } = await import('../firebase-admin.js')
    expect(typeof firebaseAuth.verifyIdToken).toBe('function')
    expect(typeof firebaseAuth.createUser).toBe('function')
    expect(typeof firebaseAuth.getUser).toBe('function')
    expect(typeof firebaseAuth.deleteUser).toBe('function')
    expect(typeof firebaseAuth.updateUser).toBe('function')
    expect(typeof firebaseAuth.setCustomUserClaims).toBe('function')
  })
})
