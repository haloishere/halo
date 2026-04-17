import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "status";
  ALTER TABLE "_articles_v" DROP COLUMN "version_status";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "status" "enum_articles_status" DEFAULT 'draft';
  ALTER TABLE "_articles_v" ADD COLUMN "version_status" "enum__articles_v_version_status" DEFAULT 'draft';`)
}
