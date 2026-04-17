import { vi } from 'vitest'
import type { User as FirebaseUser } from 'firebase/auth'
import type { UserProfile } from '@halo/shared'

export function makeFirebaseUser(overrides?: Partial<FirebaseUser>): FirebaseUser {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    ...overrides,
  } as unknown as FirebaseUser
}

export function makeUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    email: 'test@example.com',
    displayName: 'Test User',
    tier: 'free',
    role: 'user',
    caregiverRelationship: null,
    diagnosisStage: null,
    challenges: null,
    onboardingCompleted: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeOnboardedUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return makeUserProfile({
    caregiverRelationship: 'child',
    diagnosisStage: 'early',
    challenges: ['behavioral', 'communication'],
    onboardingCompleted: '2024-01-02T00:00:00.000Z',
    ...overrides,
  })
}
