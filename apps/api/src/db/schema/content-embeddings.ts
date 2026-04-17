import { pgTable, uuid, text, integer, timestamp, index, vector } from 'drizzle-orm/pg-core'
import { contentItems } from './content-items.js'

export const contentEmbeddings = pgTable(
  'content_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    chunkText: text('chunk_text').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('content_embeddings_item_idx').on(table.contentItemId),
    index('content_embeddings_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
)
