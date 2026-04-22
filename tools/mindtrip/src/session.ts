import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.session.json',
)

export interface SessionRecord {
  cookies: string
  userId: number
  userRef: string
  expiresAt: number
  capturedAt: number
}

export function sessionPath(p?: string): string {
  return p ?? DEFAULT_PATH
}

export function load(p?: string): SessionRecord | null {
  try {
    return JSON.parse(fs.readFileSync(sessionPath(p), 'utf8')) as SessionRecord
  } catch {
    return null
  }
}

export function save(rec: SessionRecord, p?: string): void {
  fs.writeFileSync(sessionPath(p), JSON.stringify(rec, null, 2))
}

export function isExpiring(rec: SessionRecord): boolean {
  return rec.expiresAt - Date.now() < 5 * 60 * 1000
}

export async function createAnonymousSession(p?: string): Promise<SessionRecord> {
  const res = await fetch('https://mindtrip.ai/api/auth-v2/create-anonymous-user', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ cf_token: 'turnstile_disabled', type: 'invisible' }),
  })

  if (!res.ok) {
    throw new Error(`create-anonymous-user failed: ${res.status} ${await res.text()}`)
  }

  const rawCookies = res.headers.getSetCookie?.() ?? []
  if (!rawCookies.length) {
    throw new Error('No Set-Cookie headers in create-anonymous-user response')
  }

  // Filter out clearing cookies (Max-Age=-1 sends empty values; skip them)
  const cookies = rawCookies
    .map((c) => c.split(';')[0]!.trim())
    .filter((c) => {
      const eq = c.indexOf('=')
      return eq !== -1 && c.slice(eq + 1).length > 0
    })
    .join('; ')

  // The response body already contains the session — no second request needed
  const { session } = (await res.json()) as {
    session: { user_id: number; user: { user_ref: string }; exp: number }
  }

  const rec: SessionRecord = {
    cookies,
    userId: session.user_id,
    userRef: session.user.user_ref,
    expiresAt: session.exp * 1000,
    capturedAt: Date.now(),
  }

  save(rec, p)
  return rec
}

export async function ensureFreshSession(p?: string): Promise<SessionRecord> {
  const rec = load(p)
  if (!rec) {
    throw new Error('No session found. Run `mindtrip bootstrap` first.')
  }
  if (isExpiring(rec)) {
    return createAnonymousSession(p)
  }
  return rec
}
