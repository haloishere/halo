import { describe, it, expect } from 'vitest'
import { preventSlugChangeAfterPublish } from './preventSlugChange'

function callHook(
  data: Record<string, unknown>,
  originalDoc?: Record<string, unknown>,
) {
  return preventSlugChangeAfterPublish({
    data,
    originalDoc,
    req: {} as never,
    operation: 'update',
    context: {},
    collection: {} as never,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('preventSlugChangeAfterPublish', () => {
  it('throws when slug is changed on a published article', () => {
    expect(() =>
      callHook(
        { slug: 'new-slug', title: 'Test' },
        { _status: 'published', slug: 'old-slug' },
      ),
    ).toThrow('Cannot change slug after article has been published')
  })

  it('allows slug change on a draft article', () => {
    const result = callHook(
      { slug: 'new-slug', title: 'Test' },
      { _status: 'draft', slug: 'old-slug' },
    )
    expect(result.slug).toBe('new-slug')
  })

  it('allows same slug on a published article (no actual change)', () => {
    const result = callHook(
      { slug: 'same-slug', title: 'Updated Title' },
      { _status: 'published', slug: 'same-slug' },
    )
    expect(result.slug).toBe('same-slug')
  })

  it('allows any slug on a new article (no originalDoc)', () => {
    const result = callHook({ slug: 'brand-new', title: 'New Article' })
    expect(result.slug).toBe('brand-new')
  })

  it('allows update without slug field in data', () => {
    const result = callHook(
      { title: 'Updated Title' },
      { _status: 'published', slug: 'existing-slug' },
    )
    expect(result.title).toBe('Updated Title')
  })

  it('allows slug change when originalDoc has no slug', () => {
    const result = callHook(
      { slug: 'new-slug' },
      { _status: 'published' },
    )
    expect(result.slug).toBe('new-slug')
  })
})
