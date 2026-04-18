# Halo

A personal AI vault. A structured, private store of context about the user — preferences, routines, interests, history — that travels with them across AI tools. The vault is the product. Only Halo's agent can read or write it; every external interaction is brokered through that single boundary.

V1 ships in Luzern with the agent specialised for local restaurant and activity recommendations.

## Stack

- **Mobile**: React Native + Expo Router (Tamagui)
- **API**: Fastify (TypeScript), Hono-compatible layer
- **Database**: PostgreSQL + Drizzle
- **Shared**: Zod schemas as the API contract
- **LLM**: Anthropic Claude (Halo's agent)
- **Auth**: Firebase (Email/Password, Google, Apple)
- **Payments**: Stripe (subscription)
- **Hosting**: GCP Cloud Run (EU region); Firebase for auth
- **CMS**: Payload (in `apps/cms`)
- **Website**: Astro (in `apps/website`)

## Workspaces

```
apps/api       → @halo/api       Fastify backend
apps/mobile    → @halo/mobile    Expo app
apps/cms       → @halo/cms       Payload CMS
apps/website   → @halo/website   Astro marketing site
packages/shared → @halo/shared   Zod schemas + types shared across apps
infra/         Terraform (GCP, Cloud Run, Cloud SQL, KMS, VPC)
```

## Quick Start

```bash
pnpm install
pnpm --filter @halo/shared build

# Mobile only (fastest path to a running app — needs Firebase configured)
pnpm --filter @halo/mobile start

# API
pnpm --filter @halo/api test:db:up   # Docker test DB on :5434
pnpm --filter @halo/api dev
```

## Configure

This codebase was scaffolded from a prior project and **all service-specific IDs have been replaced with `REPLACE_ME_*` placeholders**. Fill them in before first build.

### 1. GitHub

- Org: `haloishere`
- Repo: create `halo` empty on GitHub, then:
  ```bash
  git remote add origin git@github.com:haloishere/halo.git
  git push -u origin main
  ```

### 2. Firebase — required for auth (demo-critical)

Console: <https://console.firebase.google.com/>

1. Create project. The **projectId** doubles as a GCP project ID.
2. Authentication → enable **Email/Password**, **Google**, **Apple**.
3. Register three apps under **Your apps**:
   - iOS — bundle `com.halo.app`
   - Android — package `com.halo.app`
   - Web — any nickname; this generates the Web client ID
4. Copy the Web app config values.

| Placeholder | Example | File |
|---|---|---|
| `REPLACE_ME_FIREBASE_PROJECT_ID` | `halo-ab12c` | `apps/mobile/app.config.ts` |
| `REPLACE_ME_FIREBASE_API_KEY` | `AIzaSy...` | `apps/mobile/app.config.ts` |
| `REPLACE_ME_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | `apps/mobile/app.config.ts` |
| `REPLACE_ME_FIREBASE_APP_ID` | `1:123...:web:abc...` | `apps/mobile/app.config.ts` |
| `REPLACE_ME_GOOGLE_WEB_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | `apps/mobile/app.config.ts` |

`REPLACE_ME_FIREBASE_PROJECT_ID` appears three times in `app.config.ts` (`projectId`, `authDomain`, `storageBucket`) — replace all three with the same value.

Firebase client values are **public by design** (embedded in the binary). Security is enforced by Firebase Security Rules + the registered bundle IDs, not by hiding these strings.

### 3. EAS (only for native builds)

```bash
cd apps/mobile
npx eas-cli init    # generates a projectId
```

| Placeholder | File |
|---|---|
| `REPLACE_ME_EAS_PROJECT_ID` | `apps/mobile/app.config.ts` |
| `REPLACE_ME_APPLE_ID_EMAIL` | `apps/mobile/eas.json` |

For Expo Go / simulator demos you can skip EAS — `expo start` runs without a projectId (warning only).

### 4. GCP — skip if demo is mobile-only

Console: <https://console.cloud.google.com/>

1. Create project (or reuse the Firebase projectId).
2. Enable: Cloud Run, Cloud SQL Admin, Secret Manager, Cloud Build, Artifact Registry, Cloud KMS, Vertex AI.
3. Terraform Cloud org + workspace, or switch to local state.

| Placeholder | File |
|---|---|
| `REPLACE_ME_GCP_PROJECT_ID` | `infra/terraform.tfvars` |
| `REPLACE_ME_TFC_ORGANIZATION` | `infra/versions.tf` |
| `REPLACE_ME_TFC_WORKSPACE` | `infra/versions.tf` |

To skip Terraform Cloud, replace the `cloud { ... }` block in `infra/versions.tf` with:
```hcl
backend "local" {}
```

### 5. Domain

`haloapp.tech` is referenced in `apps/mobile/eas.json`, `apps/website/*`, and a few other places. Either buy the domain, or override at dev time:
```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @halo/mobile start
```

### 6. Other

| Placeholder | Purpose | File |
|---|---|---|
| `REPLACE_ME_GEMINI_API_KEY` | MCP UI tool (optional, dev-only) | `.mcp.json` |

## Fastest demo path (mobile, ~15 min)

1. Create Firebase project, register iOS/Android/Web apps.
2. Paste the 5 Firebase values into `apps/mobile/app.config.ts`.
3. `pnpm install && pnpm --filter @halo/shared build`
4. `pnpm --filter @halo/mobile start`
5. Scan QR with Expo Go; real Firebase auth works.

The mobile app runs against Firebase alone — you don't need the API, CMS, or infra until you start persisting vault data server-side.

## Key Commands

```bash
pnpm turbo build           # Build all
pnpm turbo test            # Unit tests
pnpm turbo test:coverage   # 80% coverage threshold
pnpm turbo typecheck
pnpm turbo lint
pnpm format                # Prettier
```

## Architecture notes

- **Agent as the only vault reader/writer** — authorization is collapsed to a single chokepoint instead of per-field ACLs.
- **Three vault-build paths**: connectors (pull from Google/Spotify/email), agent-proposed updates (confirmed by user), direct editing.
- **Per-user encryption keys at rest** in V1, with a migration path to client-held keys (zero-knowledge) in V2.
- **EU-only hosting** (GDPR by design). Complete audit log, consent revocation, JSON export, full delete.
