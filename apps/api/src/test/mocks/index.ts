import { vi } from 'vitest'

// Firebase Auth mock — full implementation added in Step 2
export const mockFirebaseAuth = {
  verifyIdToken: vi.fn(),
  createUser: vi.fn(),
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  updateUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
  createCustomToken: vi.fn(),
}

// Cloud KMS mock — full implementation added when encryption service is wired
export const mockKms = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateDataEncryptionKey: vi.fn(),
}

// Vertex AI mock — full implementation added in Step 3 (AI features)
export const mockVertexAi = {
  generateContent: vi.fn(),
  embedContent: vi.fn(),
}

export function resetAllMocks() {
  for (const mockObj of [mockFirebaseAuth, mockKms, mockVertexAi]) {
    for (const value of Object.values(mockObj)) {
      if (typeof value === 'function' && 'mockReset' in value) {
        ;(value as ReturnType<typeof vi.fn>).mockReset()
      }
    }
  }
}
