import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Prevents slug changes after an article has been published.
 * Changing a slug on a published article would create an orphaned row
 * in `content_items` (the old slug stays, a new row is created).
 */
export const preventSlugChangeAfterPublish: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
}) => {
  if (
    originalDoc?._status === 'published' &&
    data.slug &&
    originalDoc.slug &&
    data.slug !== originalDoc.slug
  ) {
    throw new Error('Cannot change slug after article has been published')
  }
  return data
}
