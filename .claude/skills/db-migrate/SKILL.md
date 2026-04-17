---
name: db-migrate
description: Generate and apply Drizzle ORM database migrations safely
disable-model-invocation: true
---

# Drizzle Migration Workflow

Safely generate and apply database schema changes using Drizzle Kit.

## Steps

1. **Build shared package**: Run `pnpm --filter @halo/shared build` (schema may depend on shared types)
2. **Generate migration**: Run `pnpm --filter @halo/api db:generate`
3. **Review SQL**: Read the newly generated migration file in `apps/api/drizzle/` and display the SQL to the user
4. **Ask for confirmation**: Show the migration SQL and ask the user to confirm before applying
5. **Apply migration**: Only after user confirms, run `pnpm --filter @halo/api db:migrate`
6. **Verify**: Check the migration output for success

## Safety Rules

- NEVER apply a migration without showing the SQL to the user first
- NEVER apply a migration without explicit user confirmation
- If the migration contains destructive operations (DROP TABLE, DROP COLUMN, ALTER TYPE), warn the user prominently
- If DATABASE_URL is not set, remind the user to configure it
