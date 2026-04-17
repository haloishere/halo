import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 of schema isolation (issue #81).
 *
 * Creates the `cms` PostgreSQL schema and pre-seeds `cms.payload_migrations`
 * with existing migration records. This prepares for Phase 2
 * (`20260330_move_to_cms_schema`) where all Payload tables/types are moved
 * from `public` to `cms`.
 *
 * This migration only creates the schema and seeds tracking records.
 * Table relocation happens in the subsequent Phase 2 migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS cms;

    CREATE TABLE IF NOT EXISTS cms.payload_migrations (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar,
      "batch" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "cms_payload_migrations_updated_at_idx"
      ON cms.payload_migrations USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "cms_payload_migrations_created_at_idx"
      ON cms.payload_migrations USING btree ("created_at");

    INSERT INTO cms.payload_migrations (name, batch, updated_at, created_at)
    SELECT name, batch, updated_at, created_at FROM public.payload_migrations p
    WHERE NOT EXISTS (
      SELECT 1 FROM cms.payload_migrations c WHERE c.name = p.name
    );

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS cms.payload_migrations;
    DROP SCHEMA IF EXISTS cms CASCADE;
  `)
}
