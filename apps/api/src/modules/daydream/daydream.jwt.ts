import { z } from 'zod'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export interface JwtRecord {
  idToken: string
  refreshToken: string
  firebaseApiKey: string
  expiresAt: number
  capturedAt: number
}

const jwtRecordSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  firebaseApiKey: z.string().min(1),
  expiresAt: z.number().int().positive(),
  capturedAt: z.number().int().positive(),
})

// 60 s skew — force refresh before the token actually expires to avoid requests
// starting with a valid token that expires in-flight.
const REFRESH_SKEW_MS = 60_000

interface JwtCache {
  record: JwtRecord
}

let _cache: JwtCache | null = null
// Singleflight guard: concurrent calls share the same refresh promise rather
// than each hammering Secret Manager and the googleapis refresh endpoint.
let _inflight: Promise<JwtRecord> | null = null
let _smClient: SecretManagerServiceClient | null = null

function getSmClient(): SecretManagerServiceClient {
  if (!_smClient) _smClient = new SecretManagerServiceClient()
  return _smClient
}

function getSecretName(): string {
  const name = process.env.DAYDREAM_JWT_SECRET_NAME
  if (!name) throw new Error('DAYDREAM_JWT_SECRET_NAME env var required')
  return name
}

export function isExpiring(rec: JwtRecord): boolean {
  return Date.now() + REFRESH_SKEW_MS >= rec.expiresAt
}

export async function loadFromSecretManager(): Promise<JwtRecord> {
  const secretName = getSecretName()
  const [version] = await getSmClient().accessSecretVersion({
    name: `${secretName}/versions/latest`,
  })
  const data = version.payload?.data
  if (!data) throw new Error('Daydream JWT secret is empty')
  const raw = Buffer.isBuffer(data) ? data.toString('utf-8') : new TextDecoder().decode(data as Uint8Array)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(
      `Failed to parse Daydream JWT secret as JSON (secret: ${secretName}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const result = jwtRecordSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `Daydream JWT secret has invalid structure (secret: ${secretName}): ${result.error.message}`,
    )
  }
  return result.data
}

export async function saveToSecretManager(rec: JwtRecord): Promise<void> {
  const secretName = getSecretName()
  await getSmClient().addSecretVersion({
    parent: secretName,
    payload: { data: Buffer.from(JSON.stringify(rec)) },
  })
}

export async function refreshJwt(rec: JwtRecord): Promise<JwtRecord> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(rec.firebaseApiKey)}`
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: rec.refreshToken,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`JWT refresh failed: ${res.status} ${text}`)
  }
  const j = (await res.json()) as { id_token: string; refresh_token: string; expires_in: string }
  const now = Date.now()
  return {
    idToken: j.id_token,
    refreshToken: j.refresh_token,
    firebaseApiKey: rec.firebaseApiKey,
    expiresAt: now + Number(j.expires_in) * 1000,
    capturedAt: now,
  }
}

async function _loadAndMaybeRefresh(): Promise<JwtRecord> {
  const rec = await loadFromSecretManager()
  if (!isExpiring(rec)) {
    _cache = { record: rec }
    return rec
  }
  const fresh = await refreshJwt(rec)
  try {
    await saveToSecretManager(fresh)
  } catch (saveErr) {
    // Persist failure is non-fatal for this instance — we continue with the
    // in-memory token. The next process restart will attempt another refresh.
    process.stderr.write(
      `[daydream.jwt] ERROR: failed to persist refreshed JWT to Secret Manager — ` +
        `running on in-memory token only. Error: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}\n`,
    )
  }
  _cache = { record: fresh }
  return fresh
}

export async function getJwt(): Promise<JwtRecord> {
  if (_cache && !isExpiring(_cache.record)) {
    return _cache.record
  }
  if (_inflight) return _inflight
  _inflight = _loadAndMaybeRefresh().finally(() => {
    _inflight = null
  })
  return _inflight
}

export async function forceRefreshJwt(): Promise<JwtRecord> {
  const rec = await loadFromSecretManager()
  const fresh = await refreshJwt(rec)
  try {
    await saveToSecretManager(fresh)
  } catch (saveErr) {
    process.stderr.write(
      `[daydream.jwt] ERROR: failed to persist force-refreshed JWT to Secret Manager. Error: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}\n`,
    )
  }
  _cache = { record: fresh }
  return fresh
}

/** Reset in-process state — call in test teardown only. */
export function _resetJwtCache(): void {
  _cache = null
  _inflight = null
  _smClient = null
}
