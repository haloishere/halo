-- Stage 5: add `users.city` (additive).
--
-- drizzle-kit also wanted to DROP the 13 legacy Holda tables + 4 pgEnums that
-- Stage 1 deleted from the Drizzle schema files. Those DROPs are deliberately
-- held back until Stage 7's destructive migration — per cloudbuild.yaml's
-- "migrations must be additive" rule, the old revision still serves 100%
-- traffic during step 3 and could 500 on a stray legacy read.
--
-- The snapshot in meta/0009_snapshot.json correctly reflects "legacy tables
-- absent from schema"; Stage 7 will ship a hand-authored DROP migration that
-- reconciles the DB with the snapshot's intent.

ALTER TABLE "users" ADD COLUMN "city" text;
