# Halo — Personal AI Vault

A structured, private store of context about the user (preferences, routines, interests, history) that travels with them across AI tools. **The vault is the product.** Only Halo's own agent can read or write it; every external interaction is brokered through that single boundary.

**V1 focus**: Luzern. Agent specialised for local restaurant + activity recommendations as the proof of value.

## Status

> This codebase was scaffolded from a prior project ("Holda"). The **tech stack, monorepo layout, auth flow, and design system are being reused**. Domain content (schemas, routes, onboarding screens, tabs) is being progressively rewritten for Halo's vault/chat model. Expect to encounter files still carrying the old domain's names (e.g. `care-recipients`, `community-posts`, `ai-chat`) — these are either being renamed/repurposed or removed.
>
> **Before making changes, check `README.md` → "Configure"** for the list of `REPLACE_ME_*` placeholders that must be filled in (Firebase, GCP, EAS, etc.).

## Domain

- **`haloapp.tech`** — all URLs, email senders, and references. API staging: `api-staging.haloapp.tech`. Production: `api.haloapp.tech`. OTP sender: `noreply@haloapp.tech`.

## Architecture overview

### The security boundary

The agent is the only component with read/write access to the vault. All access flows through it:

1. User talks to Halo's agent (mobile app).
2. Agent reads the vault, decides what's minimally relevant for the request.
3. If external data is needed, agent calls out (restaurant DB, maps, another LLM) sharing only derived intent — never raw vault content.
4. External answer returns to the agent; agent returns a user-facing reply.

Raw vault data never crosses the boundary. Only intent and necessary context flow out; only answers flow back. Every access is written to an append-only audit log the user can inspect.

### Vault build paths

The user never writes a profile from scratch. The vault grows three ways:
1. **Connectors** — pull structured data from services the user already uses (Google, Spotify, email, calendar).
2. **Agent-proposed updates** — after each conversation the agent proposes structured updates; the user confirms or rejects.
3. **Direct editing** — the user can add/edit/remove vault entries by hand.

### Data model (to be built)

- `vault_entries` — typed, encrypted, user-scoped records of preferences/routines/facts
- `vault_access_log` — append-only audit of every read/write, with purpose attribution
- `agent_conversations` / `agent_messages` — stored verbatim; the agent re-reads these to propose vault updates
- `consents` — per-connector / per-external-service scopes the user has granted
- `connectors` — OAuth tokens + sync state for Google / Spotify / etc.

### Encryption posture

- **V1**: per-user encryption keys at rest via GCP KMS envelope encryption. Server holds the KEK; the DEK decrypts vault contents on read.
- **V2** (future): client-held keys (zero-knowledge). The agent still needs to read the vault — likely solved with enclave-run inference or server-side tool brokering against client-decrypted payloads.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo Router + Tamagui |
| Backend | Fastify (TypeScript), Zod-validated I/O |
| Database | PostgreSQL + Drizzle ORM, pgvector for embeddings |
| Shared | Zod schemas as the API contract (`@halo/shared`) |
| LLM | Anthropic Claude (Halo's agent) |
| Auth | Firebase (Email/Password, Google, Apple) |
| Payments | Stripe subscription |
| CMS | Payload |
| Website | Astro |
| Hosting | GCP Cloud Run (EU region) |
| IaC | Terraform |

## Workspaces

```
apps/api       → @halo/api       Fastify backend
apps/mobile    → @halo/mobile    Expo Router app
apps/cms       → @halo/cms       Payload CMS
apps/website   → @halo/website   Astro marketing
packages/shared → @halo/shared   Zod schemas + shared types
infra/         Terraform (Cloud Run, Cloud SQL, KMS, VPC, Cloud Armor)
```

## Local dev

```bash
pnpm install
pnpm --filter @halo/shared build

# Mobile standalone (only needs Firebase configured)
pnpm --filter @halo/mobile start

# API + test DB (docker)
pnpm --filter @halo/api test:db:up        # pgvector:pg15 on :5434
pnpm --filter @halo/api dev

# Integration tests (needs test DB up)
pnpm --filter @halo/api test:integration
```

## Key commands

```bash
pnpm turbo build
pnpm turbo test
pnpm turbo test:coverage   # 80% threshold
pnpm turbo typecheck
pnpm turbo lint
pnpm format
```

## Conventions inherited from the scaffold (keep)

- **Zod at every boundary** — request/response schemas live in `@halo/shared`, shared with mobile.
- **Drizzle schema files per table** in `apps/api/src/db/schema/*.ts`, re-exported through `index.ts`.
- **Service / route split** — routes validate + auth, services contain business logic.
- **Envelope encryption** for all user-identifiable data, via `lib/encryption.ts` + GCP KMS.
- **Append-only audit logs** — every vault access goes through `writeAuditLog` (non-throwing, fire-and-forget).
- **Structured logging via Pino**, Sentry for errors, OpenTelemetry for traces.
- **Test coverage 80%+** — unit (Vitest) + integration (real Postgres via Docker Compose).

## Scaffold patterns (detail)

### API (`apps/api`)

- **`buildApp({ skipDb: true })`** — Use `skipDb: true` for unit tests. No DATABASE_URL needed.
- **`createTestApp()`** — Helper in `src/test/helpers.ts`. Wraps `buildApp` with `logger: false, skipDb: true`.
- **Drizzle plugin** (`src/plugins/drizzle.ts`) — Owns the `postgres` (porsager) client directly. Closes the pool via `onClose` hook. TLS enforced in production.
- **Error handler** (`src/plugins/error-handler.ts`) — `ZodError → 400` with field details, 5xx → Sentry + generic message, 4xx → sanitized (no internal detail leaks).
- **Sentry + OpenTelemetry** — Initialized in `server.ts` before app starts. Never imported in tests.
- **Request IDs** — `crypto.randomUUID()`, propagated via `x-request-id`.
- **Rate limiting** — Global default via `@fastify/rate-limit`; health checks (`/healthz`, `/livez`) exempt. Route-level overrides for auth/OTP hotspots (e.g. `/register` 3/IP/hour, `/otp/send` 5/IP/hour, `/otp/verify` 10/IP/hour).
- **Zod validation** — `fastify-type-provider-zod` for all route schemas.
- **`buildApp({ skipRoutes: true })`** — Use in route-level unit tests to avoid double registration when importing routes manually.
- **`verifyAuth` preHandler** — Opt-in per route, not a global plugin. Decodes Firebase JWT and attaches `request.user`.
- **`upsertDbUser()`** — Single source of truth for DB user creation/update. Used by `registerUser`, `syncUser`, and OTP `verifyOtp`. Rejects email conflicts with 409 (prevents account takeover). Sanitizes `displayName` (strips `<>&"`).
- **`encryption` singleton** — Lazy-init to avoid test env issues; call `_resetEncryptionInstance()` for test teardown.
- **`writeAuditLog()`** — Swallows DB errors (audit failure must NOT break the caller's flow). Accepts optional Pino logger.
- **OTP service** — SHA-256 hashed code storage, timing-safe comparison, per-code attempt limits (5), per-email lockout (10 attempts / 30 min), TOCTOU-safe consumption, anti-enumeration on `/send`.

### Shared (`packages/shared`)

- Zod schemas in `src/schemas/` are the single source of truth for API contracts.
- Enums in `src/constants/enums.ts` — defined as `as const` arrays with derived types.
- Build before testing API: `pnpm --filter @halo/shared build`.

### Database schema

- `.$onUpdate(() => new Date())` on all `updatedAt` columns.
- Enum values exist in both shared constants and Drizzle pgEnums (consolidate when adding routes).
- Tables with user-identifiable data require **envelope encryption** (see Encryption section).
- `audit_logs` — immutability triggers applied via migration.
- `otp_codes` — time-limited OTP codes with attempt tracking and `(email, expiresAt)` index.

### Mobile (`apps/mobile`)

- **Dev client builds** — Uses `expo-dev-client` (not Expo Go) because native modules (Google Sign-In, Reanimated, SecureStore, react-native-svg) require custom native builds.
- **EAS build profiles** — `development` (debug APK, dev client), `e2e` (debug APK without dev client, for Maestro), `preview` (release APK, staging API), `production` (AAB for store submission).
- **Metro monorepo config** — `watchFolders` includes monorepo root, `nodeModulesPaths` includes both local and root `node_modules`. React singleton resolver with try-catch fallback for sub-paths.
- **Babel plugins** — `@tamagui/babel-plugin` for component extraction, `react-native-reanimated/plugin` (must be last).
- **Firebase JS SDK** — Uses `firebase` (not `@react-native-firebase`) for simpler Expo managed workflow. Config hardcoded in `app.config.ts` (intentionally public client credentials — security boundary is Firebase Security Rules, not these values).
- **Google Sign-In** — `@react-native-google-signin/google-signin` (native module). Configured via `configureGoogleSignIn(webClientId)` in `_layout.tsx` at startup. Two cancellation paths: `SIGN_IN_CANCELLED` error code + missing idToken (both return `null`).
- **Auth flow** — OTP passwordless + Google Sign-In converge at `useAuth` → `POST /v1/auth/sync` (upsert). `syncWithRetry()` checks `result.success` and retries once with 1 s delay. Auth store exposes `syncError` for user-facing display. `clearUser(preserveSyncError?)` for atomic state updates.
- **`getAuthErrorMessage()`** — Returns `string | null`. `null` means "not an error" (e.g., user cancelled). Callers must handle null explicitly: `if (message) showToast(...)` or `?? undefined` for state setters.
- **`eas-build-post-install`** — Script in `package.json` builds `@halo/shared` during EAS cloud builds.
- **USB development** — `adb reverse tcp:8081 tcp:8081` to tunnel Metro through USB when no WiFi available.
- **Dev client env vars** — `EXPO_PUBLIC_*` vars in `eas.json` are baked into EAS cloud builds only. When running a dev client with Metro locally, the JS bundle uses your local shell env. **Always run Metro against the staging API**: `EXPO_PUBLIC_API_URL=https://api-staging.haloapp.tech pnpm --filter @halo/mobile dev`.
- **Native module rebuilds** — Adding packages with native code requires a new dev client build. Pure JS packages work immediately with Metro hot reload.
- **Run full CI checks before pushing** — `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` locally before every `git push`. Mirrors the `lint-test.yml` CI pipeline.
- **API layer** — React Query mutations/queries in `src/api/`. Auto-injects Firebase JWT via `Authorization: Bearer`. `apiRequest` returns `{ success, data?, error? }` envelope (never throws on network error).

### Environment configuration

- **No `.env` files** — The project does not use `.env` files for configuration.
- **API local dev** — Uses `direnv` with `.envrc` (copy from `.envrc.example`). Secrets fetched from GCP Secret Manager via `gcloud secrets versions access`.
- **Mobile** — Firebase config and `googleWebClientId` hardcoded in `app.config.ts` (intentionally public client credentials). API URL set per EAS build profile in `eas.json` via `EXPO_PUBLIC_API_URL`.
- **Production** — Cloud Run env vars are set by Terraform (secrets via Secret Manager `value_source`).
- **CI/CD** — Tests use `skipDb: true` and mocks; no env vars needed. Deploy workflow uses Workload Identity Federation.
- **Terraform vars** — Sensitive values come from GitHub Actions `secrets.*`. Non-sensitive config from `vars.*`. All passed as `TF_VAR_*` env vars in `.github/workflows/terraform.yml`.

### Encryption

- Envelope encryption: single Cloud KMS KEK + per-user DEKs (NOT per-user KMS keys — cost/complexity tradeoff).
- `LocalEncryptionService` (dev/test): AES-256-GCM with SHA-256(userId) AAD.
- `KmsEncryptionService` (production): Cloud KMS KEK wraps per-field random DEKs, raw userId AAD.
- Cloud KMS encryption service required before writing to any user-identifiable table.

### Testing

- **Vitest** for all unit + integration tests.
- `*.test.ts` = unit tests, `*.integration.test.ts` = integration tests.
- **80% coverage threshold** enforced by Vitest config.
- Integration tests need Docker Compose: `pgvector:pg15` on port **5434**.
- API coverage excludes: `db/**`, `plugins/**`, `lib/sentry`, `lib/telemetry` (integration-tested).
- Mobile: 80% coverage threshold enforced.

### Deployment

Push to `main` → `Lint & Test` (CI) → on success → `Deploy API` → Cloud Build (6 steps):
1. **Build** Docker image
2. **Push** to Artifact Registry
3. **Migrate** DB (runs migration entrypoint from the built image)
4. **Deploy** to Cloud Run with `--no-traffic --tag=canary`
5. **Health check** canary revision via `/livez` (3 retries)
6. **Promote** canary to 100% traffic

### Gotchas

- **ESM `.js` extensions required**: Both `apps/api` and `packages/shared` use `"type": "module"`. ALL relative imports must include `.js` extensions (e.g., `from './users.js'`). TypeScript with `moduleResolution: "bundler"` won't catch missing extensions at compile time, but Node.js will crash at runtime with `ERR_MODULE_NOT_FOUND`.
- **pnpm strict hoisting + Docker**: `.npmrc` has `shamefully-hoist=false`. Each workspace keeps deps in its own `node_modules/`. The Dockerfile must copy `node_modules` for every workspace whose code runs in production (currently: root, `apps/api`, `packages/shared`).
- **Cloud Run startup probe path is intercepted**: The path configured as `startup_probe` (`/healthz`) returns a Google Frontend 404 for external HTTP requests. Internal probes work fine. Use `/livez` (liveness probe) for external health checks.
- **gcloud `--format` is NOT JMESPath**: `value(list[?field=="x"].prop)` silently returns empty. Use `--format=json` piped to `python3 -c "..."` for filtered queries.

### Domain rules

- **Encrypt before storing**: All user-identifiable vault data must use envelope encryption.
- **Audit everything**: Mutations to sensitive tables must create audit log entries via `writeAuditLog`.
- **Validate auth server-side**: Firebase auth tokens validated via `firebase-admin` in `verifyAuth` middleware.
- **NEVER modify GCP resources directly**: All infrastructure changes MUST go through Terraform. No `gcloud` commands that create, update, or delete resources. Use `gcloud` only for read-only queries (describe, list, logs). This ensures all infra is tracked in state, auditable in git, and reproducible.

## Conventions being retired from the scaffold (expect changes)

- HIPAA / PHI framing — Halo is not a healthcare app. The encryption posture remains strict, but framing shifts to **GDPR / general-purpose privacy** (EU jurisdiction, user-controlled consent).
- Care-recipient / community / learn modules — domain-specific to the predecessor app; will be removed or repurposed.
- Vertex AI / Gemini — being replaced by Anthropic Claude as the agent LLM.

## What's safe to delete when you see it

- `care_recipients` table + routes
- `community-posts` / `community-replies` / `post-likes` / `reply-likes` / `follows` / `reports`
- `learn` / `content-items` / `content-embeddings` / `user-content-progress` / `bookmarks`
- `daily-tips` module
- Anything in `apps/mobile/app/community/` and `apps/mobile/app/learn/`
- Any reference to HIPAA, PHI, or Alzheimer's / dementia

When pruning, also remove the corresponding migrations, schemas, routes, services, mobile screens, and tests in one sweep. Don't leave orphaned imports.

## Agent behavior guidance

When asked to extend the codebase, **first check whether the feature is domain-appropriate for Halo** (vault, consent, audit, connectors, chat-with-the-agent). Features that only make sense for the predecessor app (HIPAA, PHI, caregiver community) should trigger a question to the user before any implementation.
