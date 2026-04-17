import { describe, it, expect } from 'vitest'
import {
  createConversationSchema,
  sendMessageSchema,
  submitFeedbackSchema,
  aiMessageSchema,
  aiConversationSchema,
} from '../ai-chat'

describe('createConversationSchema', () => {
  it('accepts empty object (title is optional)', () => {
    const result = createConversationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts with title', () => {
    const result = createConversationSchema.safeParse({
      title: 'Help with sundowning behavior',
    })
    expect(result.success).toBe(true)
  })

  it('rejects title exceeding 200 chars', () => {
    const result = createConversationSchema.safeParse({
      title: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty title string', () => {
    const result = createConversationSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })
})

describe('sendMessageSchema', () => {
  it('accepts valid message', () => {
    const result = sendMessageSchema.safeParse({
      content: 'How do I handle sundowning?',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty content', () => {
    const result = sendMessageSchema.safeParse({
      content: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects content exceeding 5000 chars', () => {
    const result = sendMessageSchema.safeParse({
      content: 'a'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('submitFeedbackSchema', () => {
  it('accepts thumbs_up', () => {
    const result = submitFeedbackSchema.safeParse({ rating: 'thumbs_up' })
    expect(result.success).toBe(true)
  })

  it('accepts thumbs_down', () => {
    const result = submitFeedbackSchema.safeParse({ rating: 'thumbs_down' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid rating', () => {
    const result = submitFeedbackSchema.safeParse({ rating: 'neutral' })
    expect(result.success).toBe(false)
  })
})

describe('aiMessageSchema', () => {
  const validMessage = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    conversationId: '660e8400-e29b-41d4-a716-446655440000',
    role: 'assistant',
    content: 'Sundowning is common in mid-to-late stage dementia...',
    tokenCount: 150,
    feedbackRating: null,
    createdAt: '2026-01-15T10:30:00Z',
  }

  it('accepts valid message', () => {
    const result = aiMessageSchema.safeParse(validMessage)
    expect(result.success).toBe(true)
  })

  it('accepts nullable tokenCount', () => {
    const result = aiMessageSchema.safeParse({ ...validMessage, tokenCount: null })
    expect(result.success).toBe(true)
  })

  it('rejects negative tokenCount', () => {
    const result = aiMessageSchema.safeParse({ ...validMessage, tokenCount: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = aiMessageSchema.safeParse({ ...validMessage, role: 'admin' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid feedbackRating', () => {
    const result = aiMessageSchema.safeParse({ ...validMessage, feedbackRating: 'neutral' })
    expect(result.success).toBe(false)
  })
})

describe('aiConversationSchema', () => {
  const validConversation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440000',
    title: 'Help with sundowning',
    summary: 'Discussion about managing sundowning behavior',
    createdAt: '2026-01-15T10:30:00Z',
    updatedAt: '2026-01-15T10:30:00Z',
  }

  it('accepts valid conversation', () => {
    const result = aiConversationSchema.safeParse(validConversation)
    expect(result.success).toBe(true)
  })

  it('accepts null title and summary', () => {
    const result = aiConversationSchema.safeParse({
      ...validConversation,
      title: null,
      summary: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid for id', () => {
    const result = aiConversationSchema.safeParse({ ...validConversation, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid for userId', () => {
    const result = aiConversationSchema.safeParse({ ...validConversation, userId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime format', () => {
    const result = aiConversationSchema.safeParse({
      ...validConversation,
      createdAt: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})
