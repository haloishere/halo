import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_JWT_PATH = path.resolve(__dirname, '..', '.jwt.json');

export interface JwtRecord {
  idToken: string;
  refreshToken: string;
  firebaseApiKey: string;
  expiresAt: number;
  capturedAt: number;
}

export function load(filePath = DEFAULT_JWT_PATH): JwtRecord | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as JwtRecord;
}

export function save(rec: JwtRecord, filePath = DEFAULT_JWT_PATH): void {
  fs.writeFileSync(filePath, JSON.stringify(rec, null, 2));
}

const REFRESH_SKEW_MS = 30_000;

export function isExpiring(rec: JwtRecord): boolean {
  return Date.now() + REFRESH_SKEW_MS >= rec.expiresAt;
}

export async function refresh(rec: JwtRecord): Promise<JwtRecord> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(rec.firebaseApiKey)}`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: rec.refreshToken,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`jwt refresh failed: ${res.status} ${text}`);
  }
  const j = (await res.json()) as {
    id_token: string;
    refresh_token: string;
    expires_in: string;
  };
  return {
    idToken: j.id_token,
    refreshToken: j.refresh_token,
    firebaseApiKey: rec.firebaseApiKey,
    expiresAt: Date.now() + Number(j.expires_in) * 1000,
    capturedAt: Date.now(),
  };
}

export function decodeJwtExp(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { exp?: number };
  if (!payload.exp) throw new Error('jwt missing exp claim');
  return payload.exp * 1000;
}
