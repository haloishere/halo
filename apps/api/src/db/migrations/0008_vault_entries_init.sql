-- Stage 2.2: introduce vault_entries.
-- Additive migration: creates a new table only. Existing tables / columns
-- untouched, so a stale Cloud Run revision serving 100% traffic during the
-- canary window cannot break (it just doesn't read this table).
--
-- content is opaque ciphertext (AES-256-GCM envelope, format: local:iv:tag:ct
-- in dev / kms:edek:iv:tag:ct in prod). Per-type Zod validation lives in
-- the repository layer (apps/api/src/modules/vault/), not in the DB.

CREATE TABLE IF NOT EXISTS "vault_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "vault_entries_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "vault_entries_user_id_idx"
  ON "vault_entries" ("user_id");

CREATE INDEX IF NOT EXISTS "vault_entries_user_type_idx"
  ON "vault_entries" ("user_id", "type");
