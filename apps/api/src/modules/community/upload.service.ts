import type { FastifyBaseLogger } from 'fastify'
import { getSignedUploadUrl } from '../../lib/gcs.js'

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export interface UploadUrlResult {
  uploadUrl: string
  gcsPath: string
  requiredHeaders: Record<string, string>
}

export async function generateUploadUrl(
  userId: string,
  contentType: string,
  bucket: string,
  logger?: FastifyBaseLogger,
): Promise<UploadUrlResult> {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw Object.assign(new Error('Unsupported content type'), { statusCode: 400 })
  }

  const ext = EXTENSION_MAP[contentType] ?? 'bin'
  const gcsPath = `community/${userId}/${crypto.randomUUID()}.${ext}`

  const { url, requiredHeaders } = await getSignedUploadUrl(gcsPath, bucket, contentType)

  logger?.info({ userId, gcsPath, contentType }, 'Generated community upload URL')

  return { uploadUrl: url, gcsPath, requiredHeaders }
}
