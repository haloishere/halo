import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export interface JwtRecord {
  idToken: string
  refreshToken: string
  firebaseApiKey: string
  expiresAt: number
  capturedAt: number
}

// 60 s skew — force refresh before the token actually expires to avoid race
// conditions where a request starts with a valid token that expires in-flight.
const REFRESH_SKEW_MS = 60_000

interface JwtCache {
  record: JwtRecord
}

let _cache: JwtCache | null = null
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
  return JSON.parse(raw) as JwtRecord
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
  return {
    idToken: j.id_token,
    refreshToken: j.refresh_token,
    firebaseApiKey: rec.firebaseApiKey,
    expiresAt: Date.now() + Number(j.expires_in) * 1000,
    capturedAt: Date.now(),
  }
}

export async function getJwt(): Promise<JwtRecord> {
  if (_cache && !isExpiring(_cache.record)) {
    return _cache.record
  }
  const rec = await loadFromSecretManager()
  if (isExpiring(rec)) {
    const fresh = await refreshJwt(rec)
    await saveToSecretManager(fresh)
    _cache = { record: fresh }
    return fresh
  }
  _cache = { record: rec }
  return rec
}

export async function forceRefreshJwt(): Promise<JwtRecord> {
  const rec = await loadFromSecretManager()
  const fresh = await refreshJwt(rec)
  await saveToSecretManager(fresh)
  _cache = { record: fresh }
  return fresh
}

/** Reset in-process state — call in test teardown only. */
export function _resetJwtCache(): void {
  _cache = null
  _smClient = null
}
