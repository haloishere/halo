# @halo/daydream-tool

Standalone Daydream.ing client. Lives outside the pnpm workspace (`tools/daydream/` is **not** in `pnpm-workspace.yaml`) so it has no dependency coupling to the app and can be developed, tested, or moved independently. When the fashion-tool feature lands in Halo, its three core files (`client.ts`, `jwt-store.ts`, `proto.ts`) lift cleanly into `apps/api/src/modules/daydream/`.

## What it does

| Command | What happens |
|---|---|
| `daydream bootstrap` | Launches headless Chromium via `puppeteer-extra` + stealth, visits daydream.ing, sniffs the Firebase `idToken`, `refreshToken`, and `apiKey` out of network traffic and IndexedDB, writes them to `.jwt.json`. Covers the **one** Vercel-shielded endpoint (`/api/login`). |
| `daydream status` | Prints JWT expiry / time remaining. |
| `daydream refresh` | Pure HTTP call to `securetoken.googleapis.com` to mint a fresh `idToken` from the stored refresh token. No browser. |
| `daydream search "<query>"` | `sendMessage` → `listProducts`. Prints the chat + message IDs plus an array of normalised product cards. Auto-refreshes the JWT if it's within 30 s of expiry. |

All four commands work from the same `.jwt.json` — bootstrap once, then `search` as many times as you like until the refresh token itself expires (Firebase refresh tokens are long-lived but do rotate on use).

## Install

```bash
cd tools/daydream
pnpm install
```

First run of `bootstrap` downloads a Chromium build (~170 MB, one-time).

## Usage

```bash
# Mint a fresh JWT (run with --headful to watch the browser)
pnpm bootstrap
# or with visible browser for debugging
pnpm bootstrap:headful

# Search
pnpm search "brown chelsea boots under 200"

# Check token health
pnpm status

# Force a manual refresh (normally transparent)
pnpm refresh
```

### Library usage

```ts
import { search, bootstrap, refreshJwt, loadJwt } from './tools/daydream/src/index.ts';

// one-time, or run in a Cloud Run Job on a schedule
await bootstrap();

// any time after
const { products } = await search('minimalist white sneakers');
for (const p of products) {
  console.log(`${p.brand} — ${p.name} — $${(p.priceCents / 100).toFixed(2)}`);
  console.log(`  ${p.shopUrl}`);
}
```

## How it works

```
┌──── bootstrap (run ~ hourly) ─────┐
│  puppeteer-extra + stealth        │
│    → daydream.ing                 │
│    → sniff Bearer + refreshToken  │
│    → write .jwt.json              │
└───────────────────────────────────┘
               │
               ▼
┌──── runtime (pure HTTP) ──────────┐
│  1. jwt-store.load()              │
│  2. if expiring → refresh()       │
│     → securetoken.googleapis.com  │
│  3. sendMessage (grpc-web)        │
│     → bff.shopper.api-web...      │
│  4. listProducts (json)           │
│     → liaison-http...             │
└───────────────────────────────────┘
```

- `src/proto.ts` — ~40 lines of protobuf encoder (varint + length-delimited + gRPC-Web frame). We only **encode** one message (`GetModuleListRequest`); the response is scanned as bytes for the messageId UUID because the structured product data comes back as JSON from a separate endpoint.
- `src/client.ts` — `sendMessage`, `listProducts`, `search`. Maps Daydream's raw JSON to a stable `DaydreamProduct` shape (brand, price in cents, affiliate `shopUrl`, etc).
- `src/jwt-store.ts` — file-backed JWT persistence + `refresh` against `securetoken.googleapis.com`. Standard Firebase token-exchange, no SDK needed.
- `src/bootstrap.ts` — the only browser-using file. Captures `idToken`, `refreshToken` (from `firebaseLocalStorage` IndexedDB), and Firebase `apiKey` (from `?key=` on Google identity URLs) in a single navigation.

## Binding into Halo later

When the feature lands (see `.claude/plans/daydream-chat-tool.md`):

1. Copy `src/client.ts`, `src/jwt-store.ts`, `src/proto.ts` into `apps/api/src/modules/daydream/`.
2. Replace `.jwt.json` file storage with **GCP Secret Manager** (drop-in at the `load`/`save` boundaries).
3. Keep `src/bootstrap.ts` **separate** — it becomes its own Cloud Run Job, triggered by Cloud Scheduler every ~45 min, and writes to Secret Manager instead of `.jwt.json`. Puppeteer never ships in the Fastify container.
4. Wrap `search()` behind the tool-calling harness (`apps/api/src/modules/ai-chat/tools/`) — see §7 of the spec.

No rewrites needed; just port the three files and swap the JWT store's I/O.

## Caveats

- **Not committed tokens**: `.jwt.json` is `.gitignore`'d. If you ever accidentally commit one, revoke it from Daydream (just trigger another bootstrap; the old anon user becomes inert).
- **Daydream's ToS**: this tool sends traffic to Daydream's affiliate links (their monetisation) and doesn't cache product data. We're a consumer-agent wrapper; we reach out to `partners.daydream.ing` before Halo GA.
- **Bootstrap fragility**: if Daydream swaps their login flow or the Vercel challenge changes shape, `bootstrap` may need updates. The pure-HTTP runtime is much more stable and would keep working from an older JWT until the refresh token itself is invalidated.
- **Shared anon session**: the captured JWT represents **one** anonymous Daydream user. Fine for a dev tool. When binding into Halo, we'll decide whether to stay shared (simple) or mint per-Halo-user anon sessions (personalised — see spec §9).
