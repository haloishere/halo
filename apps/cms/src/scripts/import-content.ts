/**
 * One-time migration script: imports existing content_items into Payload's articles collection.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... PAYLOAD_SECRET=... npx tsx src/scripts/import-content.ts
 *
 * The script:
 * 1. Reads all rows from the existing content_items table via raw SQL
 * 2. Creates each article in Payload's articles collection (skips if slug already exists)
 * 3. Sets status to 'published' but disables the sync hook (to avoid writing back)
 *
 * Safe to run multiple times — idempotent via slug uniqueness check.
 */

import { getPayload } from 'payload'
import type { ContentCategory, DiagnosisStage } from '@halo/shared'
import config from '../payload.config'

interface ContentItemRow {
  id: string
  title: string
  slug: string
  body: string
  category: ContentCategory
  diagnosis_stages: DiagnosisStage[]
  video_url: string | null
  published_at: string | null
  created_at: string
}

async function main() {
  console.log('Starting content migration...')

  const payload = await getPayload({ config })

  // Read existing content_items via raw SQL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payload.db as any
  const pool = db.pool ?? db.client
  const { rows } = (await pool.query(
    'SELECT id, title, slug, body, category, diagnosis_stages, video_url, published_at, created_at FROM public.content_items ORDER BY created_at ASC',
  )) as { rows: ContentItemRow[] }

  console.log(`Found ${rows.length} existing articles to import`)

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    // Check if article already exists in Payload
    const existing = await payload.find({
      collection: 'articles',
      where: { slug: { equals: row.slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`  SKIP: "${row.slug}" (already exists)`)
      skipped++
      continue
    }

    try {
      await payload.create({
        collection: 'articles',
        data: {
          title: row.title,
          slug: row.slug,
          // Store Markdown as a simple paragraph in Lexical format.
          // Payload's Lexical editor will accept this as rich text.
          // For a proper conversion, use a Markdown-to-Lexical converter.
          body: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      text: row.body,
                      format: 0,
                      detail: 0,
                      mode: 'normal',
                      style: '',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          } as never,
          category: row.category,
          diagnosisStages: row.diagnosis_stages,
          videoUrl: row.video_url ?? undefined,
          _status: row.published_at ? 'published' : 'draft',
        },
        // Disable the sync hook to avoid writing back to content_items
        context: { syncingToContentItems: true },
      })

      console.log(`  OK: "${row.slug}"`)
      imported++
    } catch (error) {
      console.error(`  FAIL: "${row.slug}"`, error)
    }
  }

  console.log(
    `\nMigration complete: ${imported} imported, ${skipped} skipped, ${rows.length} total`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
