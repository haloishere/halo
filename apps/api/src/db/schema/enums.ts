import { pgEnum } from 'drizzle-orm/pg-core'
import { VAULT_TOPICS } from '@halo/shared'

// Shared pg enums live here so no two table modules have to depend on each
// other just to share a column type. `vault_topic` is authoritative at the
// DB layer; Drizzle + Zod mirror it via `VAULT_TOPICS` in @halo/shared.
export const vaultTopicEnum = pgEnum('vault_topic', VAULT_TOPICS)
