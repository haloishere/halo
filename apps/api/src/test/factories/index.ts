import { randomUUID } from 'crypto'
import type { InferSelectModel } from 'drizzle-orm'
import type {
  users,
  careRecipients,
  aiConversations,
  aiMessages,
  contentItems,
  bookmarks,
  userContentProgress,
} from '../../db/schema/index.js'

export type UserRecord = InferSelectModel<typeof users>
export type CareRecipientRecord = InferSelectModel<typeof careRecipients>
export type ConversationRecord = InferSelectModel<typeof aiConversations>
export type AiMessageRecord = InferSelectModel<typeof aiMessages>
export type ContentItemRecord = InferSelectModel<typeof contentItems>
export type BookmarkRecord = InferSelectModel<typeof bookmarks>
export type ContentProgressRecord = InferSelectModel<typeof userContentProgress>

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

export function createCareRecipientFactory(
  overrides: Partial<CareRecipientRecord> = {},
): CareRecipientRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    name: 'encrypted-name-ciphertext',
    relationship: 'spouse',
    diagnosisStage: 'middle',
    diagnosisDetails: null,
    dateOfBirth: null,
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

export function createContentItemFactory(
  overrides: Partial<ContentItemRecord> = {},
): ContentItemRecord {
  const id = randomUUID()
  return {
    id,
    title: `Test Article ${id.slice(0, 8)}`,
    slug: `test-article-${id.slice(0, 8)}`,
    body: '# Test Article\n\nThis is test content for caregivers.',
    category: 'understanding_disease',
    diagnosisStages: ['early', 'middle'],
    videoUrl: null,
    thumbnailUrl: null,
    authorId: null,
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createBookmarkFactory(overrides: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    contentItemId: randomUUID(),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createContentProgressFactory(
  overrides: Partial<ContentProgressRecord> = {},
): ContentProgressRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    contentItemId: randomUUID(),
    progressPercent: 0,
    completedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}
