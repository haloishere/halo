import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import type { VaultEntryInput, VaultEntryListItem, VaultEntryRecord, VaultTopic } from '@halo/shared'
import {
  insertVaultEntry,
  findVaultEntriesByTopic,
  softDeleteVaultEntry,
} from './vault.repository.js'

// Thin pass-through over the repository. Exists so routes depend on a module
// boundary they control, and so future cross-cutting concerns (rate-limiting,
// feature flags, tenant-scoped rewrites) have a natural home above the repo.

export async function createEntry(
  db: DrizzleDb,
  userId: string,
  input: VaultEntryInput,
  logger?: FastifyBaseLogger,
): Promise<VaultEntryRecord> {
  return insertVaultEntry(db, userId, input, logger)
}

export async function listEntriesByTopic(
  db: DrizzleDb,
  userId: string,
  topic: VaultTopic,
  logger?: FastifyBaseLogger,
): Promise<VaultEntryListItem[]> {
  return findVaultEntriesByTopic(db, userId, topic, logger)
}

export async function deleteEntry(
  db: DrizzleDb,
  userId: string,
  id: string,
  _logger?: FastifyBaseLogger,
): Promise<void> {
  await softDeleteVaultEntry(db, userId, id)
}
