import { and, eq, isNull } from 'drizzle-orm'
import type { DrizzleDb } from '../../db/types.js'
import { vaultEntries } from '../../db/schema/index.js'
import { encryption } from '../../lib/encryption.js'
import { writeAuditLog } from '../../lib/audit.js'
import {
  vaultEntryRecordSchema,
  type VaultEntryInput,
  type VaultEntryRecord,
  type VaultEntryType,
  type PreferenceContent,
} from '@halo/shared'

// TODO(stage-2-vault-access-log): record reads in vault_access_log once that
// table lands; per the migration plan reads will dwarf audit_logs volume so
// they need their own table + retention policy.

type DecryptedContent = VaultEntryRecord['content']

interface DecryptedRow {
  id: string
  userId: string
  type: VaultEntryType
  content: DecryptedContent | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export async function insertVaultEntry(
  db: DrizzleDb,
  userId: string,
  input: VaultEntryInput,
): Promise<VaultEntryRecord> {
  const ciphertext = await encryption.encryptField(JSON.stringify(input.content), userId)

  const [row] = await db
    .insert(vaultEntries)
    .values({ userId, type: input.type, content: ciphertext })
    .returning()

  if (!row) {
    throw new Error('Failed to insert vault entry')
  }

  await writeAuditLog(db, {
    userId,
    action: 'vault.write',
    resource: 'vault_entry',
    resourceId: row.id,
    metadata: { type: input.type },
  })

  return parseDecrypted({ ...(await decryptRow(row, userId)) })
}

export async function findVaultEntryById(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<VaultEntryRecord | null> {
  const [row] = await db
    .select()
    .from(vaultEntries)
    .where(
      and(eq(vaultEntries.id, id), eq(vaultEntries.userId, userId), isNull(vaultEntries.deletedAt)),
    )
    .limit(1)

  if (!row) return null
  return parseDecrypted(await decryptRow(row, userId))
}

export async function findVaultEntriesByType(
  db: DrizzleDb,
  userId: string,
  type: VaultEntryType,
): Promise<VaultEntryRecord[]> {
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

  // One bad row must not poison the entire list — mirrors care-recipients pattern.
  return Promise.all(rows.map((r) => decryptRow(r, userId).then(parseDecryptedTolerant)))
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
): Promise<DecryptedRow> {
  let content: DecryptedContent | null
  try {
    const plaintext = await encryption.decryptField(row.content, userId)
    content = JSON.parse(plaintext) as DecryptedContent
  } catch {
    content = null
  }
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as VaultEntryType,
    content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function parseDecrypted(row: DecryptedRow): VaultEntryRecord {
  if (row.content === null) {
    throw Object.assign(new Error('Vault entry could not be decrypted'), { statusCode: 500 })
  }
  return vaultEntryRecordSchema.parse({
    id: row.id,
    userId: row.userId,
    type: row.type,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  })
}

function parseDecryptedTolerant(row: DecryptedRow): VaultEntryRecord {
  if (row.content === null) {
    // Return a placeholder shaped like a record so the caller can render
    // "decryption failed" without dropping the entire list.
    return {
      id: row.id,
      userId: row.userId,
      type: 'preference',
      content: null as unknown as PreferenceContent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    }
  }
  return parseDecrypted(row)
}
