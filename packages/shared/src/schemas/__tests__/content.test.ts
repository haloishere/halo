import { describe, it, expect } from 'vitest'
import {
  contentSearchSchema,
  createContentSchema,
  updateContentSchema,
  bookmarkSchema,
  progressSchema,
  contentSlugParamsSchema,
  contentIdParamsSchema,
  progressUpdateSchema,
  contentItemSchema,
  contentListItemSchema,
} from '../content'

describe('contentSearchSchema', () => {
  it('accepts empty query (all defaults)', () => {
    const result = contentSearchSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
    }
  })

  it('accepts full search params', () => {
    const result = contentSearchSchema.safeParse({
      search: 'sundowning',
      category: 'behavioral_management',
      stage: 'middle',
      limit: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects search exceeding 200 chars', () => {
    const result = contentSearchSchema.safeParse({
      search: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit below 1', () => {
    const result = contentSearchSchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 50', () => {
    const result = contentSearchSchema.safeParse({ limit: 51 })
    expect(result.success).toBe(false)
  })

  it('coerces string limit to number', () => {
    const result = contentSearchSchema.safeParse({ limit: '15' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(15)
    }
  })

  it('rejects invalid category', () => {
    const result = contentSearchSchema.safeParse({ category: 'cooking' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid cursor uuid', () => {
    const result = contentSearchSchema.safeParse({ cursor: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('createContentSchema', () => {
  const validContent = {
    title: 'Understanding Sundowning',
    slug: 'understanding-sundowning',
    body: '# Sundowning\n\nSundowning is a common behavior...',
    category: 'behavioral_management',
    diagnosisStages: ['middle', 'late'],
  }

  it('accepts valid content', () => {
    const result = createContentSchema.safeParse(validContent)
    expect(result.success).toBe(true)
  })

  it('accepts content with video URL', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid slug format', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      slug: 'Invalid Slug With Spaces',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty diagnosisStages', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      diagnosisStages: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid videoUrl', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      videoUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts body at max length (50000 chars)', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      body: 'a'.repeat(50_000),
    })
    expect(result.success).toBe(true)
  })

  it('rejects body exceeding max length', () => {
    const result = createContentSchema.safeParse({
      ...validContent,
      body: 'a'.repeat(50_001),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateContentSchema', () => {
  it('accepts partial update (title only)', () => {
    const result = updateContentSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = updateContentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates field constraints on partial', () => {
    const result = updateContentSchema.safeParse({ slug: 'Invalid Slug' })
    expect(result.success).toBe(false)
  })
})

describe('bookmarkSchema', () => {
  it('accepts valid bookmark', () => {
    const result = bookmarkSchema.safeParse({
      contentItemId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid', () => {
    const result = bookmarkSchema.safeParse({
      contentItemId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('progressSchema', () => {
  it('accepts valid progress', () => {
    const result = progressSchema.safeParse({
      contentItemId: '550e8400-e29b-41d4-a716-446655440000',
      progressPercent: 75,
    })
    expect(result.success).toBe(true)
  })

  it('rejects progress below 0', () => {
    const result = progressSchema.safeParse({
      contentItemId: '550e8400-e29b-41d4-a716-446655440000',
      progressPercent: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects progress above 100', () => {
    const result = progressSchema.safeParse({
      contentItemId: '550e8400-e29b-41d4-a716-446655440000',
      progressPercent: 101,
    })
    expect(result.success).toBe(false)
  })
})

describe('contentSlugParamsSchema', () => {
  it('accepts valid slug', () => {
    const result = contentSlugParamsSchema.safeParse({ slug: 'understanding-sundowning' })
    expect(result.success).toBe(true)
  })

  it('rejects slug with spaces', () => {
    const result = contentSlugParamsSchema.safeParse({ slug: 'invalid slug' })
    expect(result.success).toBe(false)
  })

  it('rejects empty slug', () => {
    const result = contentSlugParamsSchema.safeParse({ slug: '' })
    expect(result.success).toBe(false)
  })
})

describe('contentIdParamsSchema', () => {
  it('accepts valid uuid', () => {
    const result = contentIdParamsSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid', () => {
    const result = contentIdParamsSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('progressUpdateSchema', () => {
  it('accepts valid progress', () => {
    const result = progressUpdateSchema.safeParse({ progressPercent: 50 })
    expect(result.success).toBe(true)
  })

  it('rejects progress above 100', () => {
    const result = progressUpdateSchema.safeParse({ progressPercent: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer progress', () => {
    const result = progressUpdateSchema.safeParse({ progressPercent: 50.5 })
    expect(result.success).toBe(false)
  })
})

describe('contentItemSchema', () => {
  const validItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Understanding Sundowning',
    slug: 'understanding-sundowning',
    body: '# Sundowning\n\nContent here...',
    category: 'behavioral_management',
    diagnosisStages: ['middle', 'late'],
    videoUrl: null,
    thumbnailUrl: null,
    authorId: null,
    publishedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('accepts valid content item', () => {
    const result = contentItemSchema.safeParse(validItem)
    expect(result.success).toBe(true)
  })

  it('accepts item with videoUrl', () => {
    const result = contentItemSchema.safeParse({
      ...validItem,
      videoUrl: 'https://youtube.com/watch?v=abc',
    })
    expect(result.success).toBe(true)
  })
})

describe('contentListItemSchema', () => {
  const validListItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Understanding Sundowning',
    slug: 'understanding-sundowning',
    snippet: 'Sundowning is a common behavior...',
    category: 'behavioral_management',
    diagnosisStages: ['middle', 'late'],
    videoUrl: null,
    thumbnailUrl: null,
    isBookmarked: false,
    progressPercent: null,
    publishedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('accepts valid list item', () => {
    const result = contentListItemSchema.safeParse(validListItem)
    expect(result.success).toBe(true)
  })

  it('accepts list item with progress', () => {
    const result = contentListItemSchema.safeParse({
      ...validListItem,
      isBookmarked: true,
      progressPercent: 75,
    })
    expect(result.success).toBe(true)
  })
})
