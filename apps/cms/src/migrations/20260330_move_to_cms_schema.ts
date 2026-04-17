import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Phase 2 of schema isolation (issue #81).
 *
 * Moves all Payload-managed enum types and tables from `public` to `cms`.
 * After this migration, Payload operates entirely in the `cms` schema
 * (via `schemaName: 'cms'` in payload.config.ts).
 *
 * - ALTER TYPE/TABLE SET SCHEMA is atomic DDL (moves catalog entries, not data)
 * - Foreign keys between Payload tables auto-update (reference OIDs, not schema names)
 * - Indexes and sequences move with their tables automatically
 * - payload_migrations is NOT moved — it was already created in cms by Phase 1
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Move enum types (must move before tables that reference them)
    ALTER TYPE "public"."enum_articles_diagnosis_stages" SET SCHEMA cms;
    ALTER TYPE "public"."enum_articles_category" SET SCHEMA cms;
    ALTER TYPE "public"."enum_articles_status" SET SCHEMA cms;
    ALTER TYPE "public"."enum__articles_v_version_diagnosis_stages" SET SCHEMA cms;
    ALTER TYPE "public"."enum__articles_v_version_category" SET SCHEMA cms;
    ALTER TYPE "public"."enum__articles_v_version_status" SET SCHEMA cms;
    ALTER TYPE "public"."enum_cms_users_role" SET SCHEMA cms;

    -- Move tables (NOT payload_migrations — already in cms from Phase 1)
    ALTER TABLE "public"."articles_diagnosis_stages" SET SCHEMA cms;
    ALTER TABLE "public"."articles" SET SCHEMA cms;
    ALTER TABLE "public"."_articles_v_version_diagnosis_stages" SET SCHEMA cms;
    ALTER TABLE "public"."_articles_v" SET SCHEMA cms;
    ALTER TABLE "public"."cms_media" SET SCHEMA cms;
    ALTER TABLE "public"."cms_users_sessions" SET SCHEMA cms;
    ALTER TABLE "public"."cms_users" SET SCHEMA cms;
    ALTER TABLE "public"."payload_kv" SET SCHEMA cms;
    ALTER TABLE "public"."payload_locked_documents" SET SCHEMA cms;
    ALTER TABLE "public"."payload_locked_documents_rels" SET SCHEMA cms;
    ALTER TABLE "public"."payload_preferences" SET SCHEMA cms;
    ALTER TABLE "public"."payload_preferences_rels" SET SCHEMA cms;

    -- Drop the old payload_migrations from public (records are in cms)
    DROP TABLE IF EXISTS public.payload_migrations;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // One-way migration. Moving tables back risks collisions with Drizzle objects.
  // Rollback via Cloud SQL automated backups if needed.
  throw new Error('Irreversible migration: schema move cannot be safely rolled back')
}
