import type { FastifyBaseLogger } from 'fastify'
import { Storage } from '@google-cloud/storage'

let storage: Storage | null = null

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage()
  }
  return storage
}

const SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000 // 60 minutes
const CACHE_MARGIN_MS = 5 * 60 * 1000 // 5 min before expiry

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

/**
 * Generate a signed URL for a GCS object.
 *
 * Returns null if the path is already a full URL (e.g., from local dev),
 * if the bucket is not configured, or if GCS signing fails. A logger may be
 * passed so that signing failures (IAM denials, quota errors, network issues)
 * are surfaced via Pino/Cloud Logging instead of silently dropping the image.
 * Without the logger, the error is still swallowed — callers in the request
 * path should always pass `request.log`.
 */
export async function getSignedUrl(
  gcsPath: string,
  bucket?: string,
  logger?: FastifyBaseLogger,
): Promise<string | null> {
  if (!bucket) return null

  // Reject full URLs and path traversal — only GCS object paths allowed
  if (gcsPath.includes('://') || gcsPath.includes('..')) {
    return null
  }

  const cacheKey = `${bucket}:${gcsPath}`
  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + CACHE_MARGIN_MS) {
    return cached.url
  }

  try {
    const expiresAt = Date.now() + SIGNED_URL_EXPIRY_MS
    const file = getStorage().bucket(bucket).file(gcsPath)
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    })

    signedUrlCache.set(cacheKey, { url, expiresAt })
    return url
  } catch (err) {
    logger?.error(
      { err, gcsPath, bucket },
      'getSignedUrl failed — returning null; image will not render',
    )
    return null
  }
}

const SIGNED_UPLOAD_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB

export interface SignedUploadUrl {
  url: string
  /**
   * Headers the client MUST send on the PUT to GCS, verbatim.
   *
   * GCS V4 signed URLs commit to a specific set of "signed headers" at
   * signing time — here: `Content-Type` (set via the `contentType` parameter)
   * plus everything passed in `extensionHeaders`. The client must send each
   * signed header with the exact value used at signing time, or GCS returns
   * 403 SignatureDoesNotMatch. Unrelated headers (e.g. `User-Agent`) are not
   * part of the signature and can be sent or omitted freely.
   */
  requiredHeaders: Record<string, string>
}

/**
 * Generate a signed upload URL for a GCS object.
 * The client PUTs the file directly to this URL using the returned headers.
 */
export async function getSignedUploadUrl(
  gcsPath: string,
  bucket: string,
  contentType: string,
): Promise<SignedUploadUrl> {
  const requiredHeaders: Record<string, string> = {
    'x-goog-content-length-range': `0,${MAX_UPLOAD_BYTES}`,
  }

  const file = getStorage().bucket(bucket).file(gcsPath)
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + SIGNED_UPLOAD_EXPIRY_MS,
    contentType,
    extensionHeaders: requiredHeaders,
  })
  return { url, requiredHeaders }
}

/** Reset singleton for testing */
export function _resetStorageInstance(): void {
  storage = null
  signedUrlCache.clear()
}
