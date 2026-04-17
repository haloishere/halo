# Halo — Personal AI Vault

A structured, private store of context about the user (preferences, routines, interests, history) that travels with them across AI tools. **The vault is the product.** Only Halo's own agent can read or write it; every external interaction is brokered through that single boundary.

**V1 focus**: Luzern. Agent specialised for local restaurant + activity recommendations as the proof of value.

## Status

> This codebase was scaffolded from a prior project ("Holda"). The **tech stack, monorepo layout, auth flow, and design system are being reused**. Domain content (schemas, routes, onboarding screens, tabs) is being progressively rewritten for Halo's vault/chat model. Expect to encounter files still carrying the old domain's names (e.g. `care-recipients`, `community-posts`, `ai-chat`) — these are either being renamed/repurposed or removed.
>
> **Before making changes, check `README.md` → "Configure"** for the list of `REPLACE_ME_*` placeholders that must be filled in (Firebase, GCP, EAS, etc.).

## Domain

- **`halo.life`** — all URLs, email senders, and references. API staging: `api-staging.halo.life`. Production: `api.halo.life`. OTP sender: `noreply@halo.life`.

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
