---
name: test-integration
description: Start the test database, run API integration tests, and tear down
disable-model-invocation: true
---

# Integration Test Runner

Run the full API integration test suite with automatic database lifecycle management.

## Steps

1. **Start test database**: Run `pnpm --filter @halo/api test:db:up` to start the pgvector Docker container on port 5434
2. **Wait for readiness**: The `--wait` flag in docker compose ensures the health check passes before proceeding
3. **Build shared package**: Run `pnpm --filter @halo/shared build` (integration tests depend on it)
4. **Run integration tests**: Run `DATABASE_TEST_URL=postgresql://test:test@localhost:5434/halo_test pnpm --filter @halo/api test:integration`
5. **Tear down**: Run `pnpm --filter @halo/api test:db:down` regardless of test pass/fail
6. **Report results**: Summarize the pass/fail count and any failures
