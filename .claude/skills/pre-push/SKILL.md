---
name: pre-push
description: Run all CI/CD checks locally before committing and pushing — mirrors the lint-test.yml pipeline exactly so the PR never fails on preventable errors
---

# Pre-Push CI Gate

Run the full local equivalent of the CI pipeline before every `git push`. The order mirrors `.github/workflows/lint-test.yml`: lint → typecheck → unit tests with coverage → security audit → (optionally) integration tests.

**IMPORTANT**: If ANY step fails, stop immediately, fix the issue, and re-run from step 1. Do NOT push with failing checks.

---

## Step 1 — Lint (mirrors `pnpm turbo lint` in CI)

```bash
pnpm turbo lint
```

- Covers `@halo/api`, `@halo/mobile`, `@halo/shared`
- ESLint errors (not warnings) are blocking
- Common failures: `no-explicit-any` missing disable comment, unused imports

**Fix pattern**: Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on the line BEFORE the offending cast.

---

## Step 2 — Typecheck (mirrors `pnpm turbo typecheck` in CI)

```bash
pnpm turbo typecheck
```

- Runs `tsc --noEmit` in all three packages
- Common failures in test files:
  - `UseMutationResult` partial mock → use `as unknown as ReturnType<typeof hookFn>`
  - `UserCredential` partial mock → use `as unknown as Awaited<ReturnType<typeof fn>>`
  - Discriminated union (`ApiResponse<T>`) property access → use `if (!result.success)` narrowing before accessing `.error`; use `if (result.success)` before accessing `.data`
  - Missing `@types/X` for packages that don't bundle their own declarations

---

## Step 3 — Unit Tests with Coverage (mirrors `unit-tests` job)

```bash
ENCRYPTION_DEV_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef pnpm turbo test:coverage
```

- `ENCRYPTION_DEV_KEY` must be set — a fixed 64-char hex string is fine for local dev
- Coverage threshold: **80%** lines/functions/branches/statements (enforced by Vitest config)
- Mobile test timeout is 30s per test — normal for RNTL first render

**If a test flakes**: Replace `await setTimeout(0)` patterns with `await waitFor(() => ...)` from `@testing-library/react-native`.

---

## Step 4 — Security Audit (mirrors `security-audit` job)

```bash
pnpm audit --audit-level=critical
```

- Only CRITICAL vulnerabilities are blocking (HIGH/MEDIUM known issues in RN transitive deps are pre-existing)
- If a new critical appears: investigate, update the dep, re-run

---

## Step 5 — Integration Tests (optional, requires Docker)

Only run if you modified API routes, middleware, DB schema, or migration files. Skip for mobile-only or test-only changes.

```bash
# Uses the test-integration skill
/test-integration
```

Requires Docker running. Uses pgvector:pg15 on port 5434.

---

## Step 6 — Commit & Push

Only after all required steps pass:

```bash
git add <specific files>   # Never git add -A — avoid accidentally staging .env
git commit -m "type(scope): description"
git push
```

Commit message format: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`, `ci:`, `perf:`

---

## Quick Reference — Which Steps to Run

| Change type | Lint | Typecheck | Unit tests | Audit | Integration |
|---|---|---|---|---|---|
| Test files only | ✓ | ✓ | ✓ | — | — |
| Mobile UI/screens | ✓ | ✓ | ✓ | — | — |
| API routes/service | ✓ | ✓ | ✓ | — | ✓ |
| DB schema/migration | ✓ | ✓ | ✓ | — | ✓ |
| Dependencies added | ✓ | ✓ | ✓ | ✓ | — |
| CI/infra only | ✓ | ✓ | — | — | — |

---

## Environment Variables Required

| Var | Used by | Value for local dev |
|---|---|---|
| `ENCRYPTION_DEV_KEY` | API unit + integration tests | Any 64-char hex string |
| `DATABASE_URL` | Integration tests (set automatically by `/test-integration`) | `postgresql://test:test@localhost:5434/halo_test` |
