import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import type { SerializedEditorState } from 'lexical'
import { DIAGNOSIS_STAGES } from '@halo/shared'
import { lexicalToMarkdown } from '../lib/lexicalToMarkdown'

const DELETE_SQL = `DELETE FROM public.content_items WHERE slug = $1`

const UPSERT_SQL = `
  INSERT INTO public.content_items (title, slug, body, category, diagnosis_stages, video_url, thumbnail_url, published_at, created_at, updated_at)
  VALUES ($1, $2, $3, $4::public.content_category, $5::public.diagnosis_stage[], $6, $7, $8, $8, $8)
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    category = EXCLUDED.category,
    diagnosis_stages = EXCLUDED.diagnosis_stages,
    video_url = EXCLUDED.video_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    published_at = COALESCE(content_items.published_at, EXCLUDED.published_at),
    updated_at = EXCLUDED.updated_at
`

/**
 * afterChange hook for the Articles collection.
 * When an article is published, upserts it into the `content_items` table
 * that the Fastify API serves to the mobile app.
 *
 * Uses Payload's underlying Drizzle session to execute raw SQL against
 * the shared database. This avoids inter-service HTTP calls.
 */
export const syncToContentItems: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
  context,
}) => {
  // Prevent infinite loops if this hook is triggered recursively
  if (context.syncingToContentItems) return

  const { payload } = req

  // Handle unpublish: previously published article reverted to draft
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = payload.db as any
    const pool = db.pool ?? db.client
    try {
      await pool.query(DELETE_SQL, [doc.slug])
      payload.logger.info(`Unpublished article "${doc.slug}" removed from content_items`)
    } catch (error) {
      payload.logger.error(
        { err: error, slug: doc.slug },
        `Failed to remove unpublished article "${doc.slug}" from content_items`,
      )
      throw error
    }
    return
  }

  // Only sync published articles
  if (doc._status !== 'published') return

  try {
    // Convert Lexical rich text to Markdown for mobile rendering
    const body = await lexicalToMarkdown(doc.body as SerializedEditorState, payload.config)

    // Extract thumbnail path for the mobile app.
    // In production (GCS storage plugin), store the GCS object path so Fastify
    // can generate signed URLs. In dev (local filesystem), store the full URL.
    //
    // Payload's afterChange hook delivers relationship fields as raw IDs (number),
    // not populated objects. We must call findByID to resolve the media document.
    let thumbnailUrl: string | null = null
    if (doc.thumbnail) {
      let media: Record<string, unknown> | null = null

      if (typeof doc.thumbnail === 'object') {
        media = doc.thumbnail as Record<string, unknown>
      } else {
        try {
          const populated = await payload.findByID({
            collection: 'cms-media',
            id: doc.thumbnail as number | string,
            disableErrors: true,
            overrideAccess: true,
          })
          media = (populated ?? null) as Record<string, unknown> | null
        } catch (findError) {
          payload.logger.error(
            { err: findError, thumbnailId: doc.thumbnail, slug: doc.slug },
            `Failed to resolve thumbnail media for article "${doc.slug}" — syncing without thumbnail`,
          )
        }
      }

      const filename = media?.filename as string | undefined
      if (filename) {
        const gcsPrefix = process.env.GCS_MEDIA_PREFIX ?? 'cms'
        const sizes = media?.sizes as Record<string, { filename?: string }> | undefined
        const cardFilename = sizes?.card?.filename ?? filename
        thumbnailUrl = `${gcsPrefix}/${cardFilename}`
      } else {
        payload.logger.warn(
          { thumbnailId: doc.thumbnail, slug: doc.slug },
          `Thumbnail media for article "${doc.slug}" could not be resolved — syncing without thumbnail`,
        )
      }
    }

    const rawStages: unknown[] = Array.isArray(doc.diagnosisStages) ? doc.diagnosisStages : []
    const validStages = DIAGNOSIS_STAGES as readonly string[]
    const stages = rawStages.filter(
      (s): s is string => typeof s === 'string' && validStages.includes(s),
    )
    const stagesArray = `{${stages.join(',')}}`
    const now = new Date().toISOString()
    const videoUrl = (doc.videoUrl as string | undefined) ?? null

    // Execute raw SQL via Payload's db adapter pool
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = payload.db as any
    const pool = db.pool ?? db.client
    await pool.query(UPSERT_SQL, [
      doc.title,
      doc.slug,
      body,
      doc.category,
      stagesArray,
      videoUrl,
      thumbnailUrl,
      now,
    ])

    payload.logger.info(`Synced article "${doc.slug}" to content_items (${operation})`)
  } catch (error) {
    payload.logger.error(
      { err: error, slug: doc.slug },
      `Failed to sync article "${doc.slug}" to content_items`,
    )
    throw error
  }
}

/**
 * afterDelete hook for the Articles collection.
 * Removes the corresponding row from `content_items` so deleted
 * articles no longer appear in the mobile app.
 */
export const deleteFromContentItems: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const { payload } = req

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = payload.db as any
    const pool = db.pool ?? db.client
    await pool.query(DELETE_SQL, [doc.slug])

    payload.logger.info(`Deleted article "${doc.slug}" from content_items`)
  } catch (error) {
    payload.logger.error(
      { err: error, slug: doc.slug },
      `Failed to delete article "${doc.slug}" from content_items`,
    )
    throw error
  }
}
