import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/gcs.js', () => ({
  getSignedUploadUrl: vi.fn().mockResolvedValue({
    url: 'https://storage.googleapis.com/signed-upload',
    requiredHeaders: { 'x-goog-content-length-range': '0,10485760' },
  }),
}))

import { generateUploadUrl } from '../upload.service.js'

describe('upload.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates upload URL for JPEG', async () => {
    const result = await generateUploadUrl('user-123', 'image/jpeg', 'test-bucket')

    expect(result.uploadUrl).toBe('https://storage.googleapis.com/signed-upload')
    expect(result.gcsPath).toMatch(/^community\/user-123\/[a-f0-9-]+\.jpg$/)
    expect(result.requiredHeaders).toEqual({
      'x-goog-content-length-range': '0,10485760',
    })
  })

  it('generates upload URL for PNG', async () => {
    const result = await generateUploadUrl('user-123', 'image/png', 'test-bucket')

    expect(result.gcsPath).toMatch(/\.png$/)
  })

  it('generates upload URL for WebP', async () => {
    const result = await generateUploadUrl('user-123', 'image/webp', 'test-bucket')

    expect(result.gcsPath).toMatch(/\.webp$/)
  })

  it('generates upload URL for HEIC', async () => {
    const result = await generateUploadUrl('user-123', 'image/heic', 'test-bucket')

    expect(result.gcsPath).toMatch(/\.heic$/)
  })

  it('rejects unsupported content type', async () => {
    await expect(generateUploadUrl('user-123', 'image/gif', 'test-bucket')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('generates unique paths for each call', async () => {
    const r1 = await generateUploadUrl('user-123', 'image/jpeg', 'test-bucket')
    const r2 = await generateUploadUrl('user-123', 'image/jpeg', 'test-bucket')

    expect(r1.gcsPath).not.toBe(r2.gcsPath)
  })
})
