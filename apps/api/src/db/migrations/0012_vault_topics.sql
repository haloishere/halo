-- Personal Memory: topic routing for vault_entries + ai_conversations.
-- `vault_topic` is the authoritative gate; Drizzle + Zod mirror it in code.

CREATE TYPE "public"."vault_topic" AS ENUM('food_and_restaurants', 'fashion', 'lifestyle_and_travel');--> statement-breakpoint

-- Pre-flight visibility: warn if non-empty tables are about to be backfilled.
-- RAISE NOTICE logs to the Postgres server log without blocking the migration,
-- so operator can review what was classified as food_and_restaurants after the
-- fact. Staging is empty at Phase 1 ship time; production rollout must read
-- these notices or split into an explicit per-row backfill.
DO $$
DECLARE
  ve_count bigint;
  ac_count bigint;
BEGIN
  SELECT COUNT(*) INTO ve_count FROM vault_entries;
  SELECT COUNT(*) INTO ac_count FROM ai_conversations;
  IF ve_count > 0 THEN
    RAISE NOTICE 'migration 0012: backfilling % vault_entries rows with topic=food_and_restaurants', ve_count;
  END IF;
  IF ac_count > 0 THEN
    RAISE NOTICE 'migration 0012: backfilling % ai_conversations rows with topic=food_and_restaurants', ac_count;
  END IF;
END $$;--> statement-breakpoint

-- Add nullable, backfill explicitly, then enforce NOT NULL. Avoids the
-- silent mass-classification that `ADD COLUMN NOT NULL DEFAULT … / DROP
-- DEFAULT` would cause — the UPDATE is a visible statement the operator
-- can grep for and post-hoc reconstruct if needed.
ALTER TABLE "vault_entries" ADD COLUMN "topic" "vault_topic";--> statement-breakpoint
UPDATE "vault_entries" SET "topic" = 'food_and_restaurants' WHERE "topic" IS NULL;--> statement-breakpoint
ALTER TABLE "vault_entries" ALTER COLUMN "topic" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "ai_conversations" ADD COLUMN "topic" "vault_topic";--> statement-breakpoint
UPDATE "ai_conversations" SET "topic" = 'food_and_restaurants' WHERE "topic" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_conversations" ALTER COLUMN "topic" SET NOT NULL;--> statement-breakpoint

-- Partial index — soft-deleted rows are never read in scenario queries.
CREATE INDEX "vault_entries_user_topic_idx" ON "vault_entries" USING btree ("user_id","topic") WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- Phase-3 will filter conversations by (user_id, topic) for the Portrait tab.
CREATE INDEX "ai_conversations_user_topic_idx" ON "ai_conversations" USING btree ("user_id","topic");
