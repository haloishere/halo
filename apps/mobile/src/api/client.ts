import { auth } from '../lib/firebase'
import type { ApiResponse } from '@halo/shared'

/** Throws if a non-dev build is configured with an HTTP (non-HTTPS) API URL. */
export function assertHttpsInProduction(url: string, isDev: boolean): void {
  if (!isDev && url.startsWith('http://')) {
    throw new Error(`HTTPS required for production API URL. Got: ${url}`)
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

// Fail fast if a release build accidentally uses HTTP
assertHttpsInProduction(BASE_URL, typeof __DEV__ !== 'undefined' ? __DEV__ : true)

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await auth.currentUser?.getIdToken()
  // Hermes (React Native) may not support crypto.randomUUID().
  // Fallback uses 'h-' prefix for log distinguishability. NOT for security-sensitive IDs.
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  const headers: HeadersInit = {
    'x-request-id': requestId,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (err) {
    if (__DEV__) console.warn('[apiRequest] Network error:', err)
    return { success: false, error: 'Network error. Please check your connection.' }
  }

  // Handle 204 No Content (e.g. DELETE endpoints)
  if (response.status === 204) {
    return { success: true } as ApiResponse<T>
  }

  // Parse JSON safely — server may return HTML error page on 502/503
  try {
    return (await response.json()) as ApiResponse<T>
  } catch (err) {
    if (__DEV__) console.warn('[apiRequest] JSON parse error:', err)
    return { success: false, error: `Server error (${response.status}). Please try again later.` }
  }
}
