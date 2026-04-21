import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import type { DrizzleDb } from '../../db/types.js'
import { vaultEntries } from '../../db/schema/index.js'
import { encryption } from '../../lib/encryption.js'
import { writeAuditLog } from '../../lib/audit.js'
import {
  VAULT_TOPICS,
  VAULT_ENTRY_TYPES,
  vaultEntryRecordSchema,
  type VaultEntryInput,
  type VaultEntryRecord,
  type VaultEntryType,
  type VaultTopic,
  type VaultEntryListItem,
} from '@halo/shared'

// TODO(stage-2-vault-access-log): record reads in vault_access_log once that
// table lands; per the migration plan reads will dwarf audit_logs volume so
// they need their own table + retention policy.

type DecryptedContent = VaultEntryRecord['content']

interface DecryptedRow {
  id: string
  userId: string
  type: VaultEntryType
  topic: VaultTopic
  content: DecryptedContent | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

const TOPIC_PARSE = z.enum(VAULT_TOPICS)
const TYPE_PARSE = z.enum(VAULT_ENTRY_TYPES)

export type { VaultEntryListItem } from '@halo/shared'

export async function insertVaultEntry(
  db: DrizzleDb,
  userId: string,
  input: VaultEntryInput,
  logger?: FastifyBaseLogger,
): Promise<VaultEntryRecord> {
  const ciphertext = await encryption.encryptField(JSON.stringify(input.content), userId)

  const [row] = await db
    .insert(vaultEntries)
    .values({ userId, type: input.type, topic: input.topic, content: ciphertext })
    .returning()

  if (!row) {
    throw new Error('Failed to insert vault entry')
  }

  await writeAuditLog(db, {
    userId,
    action: 'vault.write',
    resource: 'vault_entry',
    resourceId: row.id,
    metadata: { type: input.type, topic: input.topic },
  })

  return parseDecrypted(await decryptRow(row, userId, logger))
}

export async function findVaultEntryById(
  db: DrizzleDb,
  userId: string,
  id: string,
  logger?: FastifyBaseLogger,
): Promise<VaultEntryRecord | null> {
  const [row] = await db
    .select()
    .from(vaultEntries)
    .where(
      and(eq(vaultEntries.id, id), eq(vaultEntries.userId, userId), isNull(vaultEntries.deletedAt)),
    )
    .limit(1)

  if (!row) return null
  return parseDecrypted(await decryptRow(row, userId, logger))
}

export const VAULT_LIST_LIMIT = 200

export async function findVaultEntriesByType(
  db: DrizzleDb,
  userId: string,
  type: VaultEntryType,
  logger?: FastifyBaseLogger,
): Promise<VaultEntryListItem[]> {
  // TODO(stage-3-pagination): add cursor pagination when agent-context
  // consumers land. Hard cap keeps a pathological vault from OOM'ing a
  // chat request that decrypts every row into memory.
  const rows = await db
    .select()
    .from(vaultEntries)
    .where(
      and(
        eq(vaultEntries.userId, userId),
        eq(vaultEntries.type, type),
        isNull(vaultEntries.deletedAt),
      ),
    )
    .orderBy(desc(vaultEntries.createdAt), desc(vaultEntries.id))
    .limit(VAULT_LIST_LIMIT)

  // One bad row must not poison the entire list — mirrors care-recipients pattern.
  return Promise.all(
    rows.map((r) => decryptRow(r, userId, logger).then((decrypted) => parseDecryptedTolerant(r, decrypted))),
  )
}

export async function softDeleteVaultEntry(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<void> {
  const [row] = await db
    .update(vaultEntries)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(vaultEntries.id, id), eq(vaultEntries.userId, userId), isNull(vaultEntries.deletedAt)),
    )
    .returning()

  if (!row) {
    throw Object.assign(new Error('Vault entry not found'), { statusCode: 404 })
  }

  await writeAuditLog(db, {
    userId,
    action: 'vault.delete',
    resource: 'vault_entry',
    resourceId: id,
  })
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function decryptRow(
  row: typeof vaultEntries.$inferSelect,
  userId: string,
  logger?: FastifyBaseLogger,
): Promise<DecryptedRow | null> {
  try {
    // Zod-parse topic + type at the read boundary so a drifted enum value
    // (future `DROP NOT NULL`, ad-hoc SQL insert bypassing the pg enum)
    // fails here instead of being passed through as a typed cast.
    const topic = TOPIC_PARSE.parse(row.topic)
    const type = TYPE_PARSE.parse(row.type)
    const plaintext = await encryption.decryptField(row.content, userId)
    const content = JSON.parse(plaintext) as DecryptedContent
    return {
      id: row.id,
      userId: row.userId,
      type,
      topic,
      content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  } catch (err) {
    // Tag the two failure classes so an operator triaging `vault.decrypt.failed`
    // can tell "KMS outage / corrupt ciphertext" from "migration-induced enum
    // drift" without reading the err field — critical for mass-alert triage.
    const failureKind = err instanceof z.ZodError ? 'schema_drift' : 'crypto'
    logger?.error(
      { err, entryId: row.id, userId, topic: row.topic, type: row.type, failureKind },
      'vault.decrypt.failed',
    )
    return null
  }
}

function parseDecrypted(decrypted: DecryptedRow | null): VaultEntryRecord {
  if (!decrypted) {
    throw Object.assign(new Error('Vault entry could not be decrypted'), { statusCode: 500 })
  }
  return vaultEntryRecordSchema.parse({
    id: decrypted.id,
    userId: decrypted.userId,
    type: decrypted.type,
    topic: decrypted.topic,
    content: decrypted.content,
    createdAt: decrypted.createdAt,
    updatedAt: decrypted.updatedAt,
    deletedAt: decrypted.deletedAt,
  })
}

function parseDecryptedTolerant(
  row: typeof vaultEntries.$inferSelect,
  decrypted: DecryptedRow | null,
): VaultEntryListItem {
  if (!decrypted) {
    // Discriminable sentinel — callers narrow via `entry.decryptionFailed === true`.
    // Raw on-disk values land on `rawType` / `rawTopic` (never the validated enum
    // fields) so a drifted value cannot be mistaken for a legitimate topic.
    return {
      id: row.id,
      userId: row.userId,
      rawType: row.type,
      rawTopic: row.topic,
      content: null,
      decryptionFailed: true,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
  return parseDecrypted(decrypted)
}
