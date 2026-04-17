import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSignedUrl = vi.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url'])

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        getSignedUrl: mockGetSignedUrl,
      }),
    }),
  })),
}))

import { getSignedUrl, getSignedUploadUrl, _resetStorageInstance } from '../gcs.js'

describe('getSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetStorageInstance()
  })

  it('returns null when bucket is undefined', async () => {
    const result = await getSignedUrl('cms/photo.jpg')
    expect(result).toBeNull()
  })

  it('returns null when bucket is empty string', async () => {
    const result = await getSignedUrl('cms/photo.jpg', '')
    expect(result).toBeNull()
  })

  it('rejects http:// paths (returns null)', async () => {
    const result = await getSignedUrl('http://localhost:3000/media/photo.jpg', 'my-bucket')
    expect(result).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects https:// paths (returns null)', async () => {
    const result = await getSignedUrl('https://example.com/media/photo.jpg', 'my-bucket')
    expect(result).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects path traversal (returns null)', async () => {
    const result = await getSignedUrl('../secret/file.txt', 'my-bucket')
    expect(result).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('calls GCS SDK with v4 signing and read action', async () => {
    await getSignedUrl('cms/card-thumb.jpg', 'halo-media-bucket')

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
    const opts = mockGetSignedUrl.mock.calls[0]![0]
    expect(opts.version).toBe('v4')
    expect(opts.action).toBe('read')
    expect(typeof opts.expires).toBe('number')
    expect(opts.expires).toBeGreaterThan(Date.now())
  })

  it('returns the signed URL from GCS SDK', async () => {
    mockGetSignedUrl.mockResolvedValueOnce(['https://storage.googleapis.com/my-signed-url'])
    const result = await getSignedUrl('cms/photo.jpg', 'my-bucket')
    expect(result).toBe('https://storage.googleapis.com/my-signed-url')
  })

  it('returns null on GCS SDK errors (try/catch)', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error('SignBlob failed'))
    const result = await getSignedUrl('cms/photo.jpg', 'my-bucket')
    expect(result).toBeNull()
  })

  it('logs GCS SDK errors via the provided logger (C3 — silent failure fix)', async () => {
    const err = new Error('SignBlob failed: PERMISSION_DENIED')
    mockGetSignedUrl.mockRejectedValueOnce(err)
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSignedUrl('cms/photo.jpg', 'my-bucket', logger as any)
    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledTimes(1)
    const [ctx, msg] = logger.error.mock.calls[0]!
    expect(ctx).toMatchObject({ gcsPath: 'cms/photo.jpg', bucket: 'my-bucket' })
    expect(ctx.err).toBe(err)
    expect(typeof msg).toBe('string')
  })
})

describe('getSignedUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetStorageInstance()
  })

  it('calls GCS SDK with v4 signing and write action', async () => {
    await getSignedUploadUrl('community/user-1/img.jpg', 'my-bucket', 'image/jpeg')

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
    const opts = mockGetSignedUrl.mock.calls[0]![0]
    expect(opts.version).toBe('v4')
    expect(opts.action).toBe('write')
    expect(opts.contentType).toBe('image/jpeg')
    expect(typeof opts.expires).toBe('number')
  })

  // C1 from PR #109 review — the invariant that was violated and is now the fix's
  // key structural guarantee: every header passed as `extensionHeaders` during
  // signing MUST also appear in the returned `requiredHeaders`, otherwise the
  // mobile client cannot echo what GCS expects.
  it('returns requiredHeaders containing every extensionHeader used for signing', async () => {
    const result = await getSignedUploadUrl('community/user-1/img.jpg', 'my-bucket', 'image/jpeg')

    const opts = mockGetSignedUrl.mock.calls[0]![0]
    const signedKeys = Object.keys(opts.extensionHeaders ?? {})
    const returnedKeys = Object.keys(result.requiredHeaders)

    // Every signed header must be present in the returned headers
    for (const key of signedKeys) {
      expect(returnedKeys).toContain(key)
      // And the value must match byte-for-byte (signature depends on exact value)
      expect(result.requiredHeaders[key]).toBe(opts.extensionHeaders[key])
    }
    // Sanity: the set is non-empty in the current implementation
    expect(signedKeys.length).toBeGreaterThan(0)
  })

  it('enforces the 10MB upload cap via x-goog-content-length-range', async () => {
    const result = await getSignedUploadUrl('community/user-1/img.jpg', 'my-bucket', 'image/png')

    const MAX = 10 * 1024 * 1024
    expect(result.requiredHeaders['x-goog-content-length-range']).toBe(`0,${MAX}`)
  })

  it('returns the signed URL from the GCS SDK response', async () => {
    mockGetSignedUrl.mockResolvedValueOnce(['https://storage.googleapis.com/upload-url'])
    const result = await getSignedUploadUrl('community/user-1/img.jpg', 'my-bucket', 'image/jpeg')
    expect(result.url).toBe('https://storage.googleapis.com/upload-url')
  })
})

describe('_resetStorageInstance', () => {
  it('resets the singleton so a new Storage is created', async () => {
    // First call creates singleton
    await getSignedUrl('cms/a.jpg', 'bucket')
    _resetStorageInstance()
    // Second call creates a new singleton
    await getSignedUrl('cms/b.jpg', 'bucket')

    const { Storage } = await import('@google-cloud/storage')
    // Storage constructor called twice (once per singleton creation)
    expect(Storage).toHaveBeenCalledTimes(2)
  })
})
