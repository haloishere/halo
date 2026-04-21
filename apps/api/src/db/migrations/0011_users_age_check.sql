-- Enforce the zod invariant [16, 120] at the DB so any write path that
-- bypasses Zod (seed, connector, bulk import) can't corrupt the column.
ALTER TABLE "users"
  ADD CONSTRAINT "users_age_bounds_check"
  CHECK ("age" IS NULL OR ("age" BETWEEN 16 AND 120));
