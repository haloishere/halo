-- Personal Memory: topic routing for vault_entries + ai_conversations.
-- `vault_topic` is the authoritative gate (DB-level enum); Drizzle + Zod mirror it.

CREATE TYPE "public"."vault_topic" AS ENUM('food_and_restaurants', 'fashion', 'lifestyle_and_travel');--> statement-breakpoint

-- ADD COLUMN NOT NULL requires a DEFAULT to backfill existing rows. Immediately
-- DROP DEFAULT so future inserts must specify `topic` explicitly — matches the
-- pattern used by migration 0011_users_age_check for DB-authoritative invariants.
ALTER TABLE "vault_entries" ADD COLUMN "topic" "vault_topic" NOT NULL DEFAULT 'food_and_restaurants';--> statement-breakpoint
ALTER TABLE "vault_entries" ALTER COLUMN "topic" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "ai_conversations" ADD COLUMN "topic" "vault_topic" NOT NULL DEFAULT 'food_and_restaurants';--> statement-breakpoint
ALTER TABLE "ai_conversations" ALTER COLUMN "topic" DROP DEFAULT;--> statement-breakpoint

-- Partial index — soft-deleted rows are never read in scenario queries, so they
-- don't belong in the index. Shrinks index size and matches the repository's
-- WHERE deleted_at IS NULL filter.
CREATE INDEX "vault_entries_user_topic_idx" ON "vault_entries" USING btree ("user_id","topic") WHERE "deleted_at" IS NULL;
