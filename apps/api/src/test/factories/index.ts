import { randomUUID } from 'crypto'
import type { InferSelectModel } from 'drizzle-orm'
import type { users, aiConversations, aiMessages } from '../../db/schema/index.js'

export type UserRecord = InferSelectModel<typeof users>
export type ConversationRecord = InferSelectModel<typeof aiConversations>
export type AiMessageRecord = InferSelectModel<typeof aiMessages>

export function createUserFactory(overrides: Partial<UserRecord> = {}): UserRecord {
  const id = randomUUID()
  return {
    id,
    firebaseUid: `firebase-uid-${id.slice(0, 8)}`,
    email: `user-${id.slice(0, 8)}@example.com`,
    displayName: `Test User ${id.slice(0, 8)}`,
    tier: 'free',
    role: 'user',
    caregiverRelationship: null,
    diagnosisStage: null,
    challenges: null,
    onboardingCompleted: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createConversationFactory(
  overrides: Partial<ConversationRecord> = {},
): ConversationRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    title: null,
    summary: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createAiMessageFactory(overrides: Partial<AiMessageRecord> = {}): AiMessageRecord {
  return {
    id: randomUUID(),
    conversationId: randomUUID(),
    role: 'user',
    content: 'encrypted-content-ciphertext',
    tokenCount: null,
    feedbackRating: null,
    safetyFlags: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}
