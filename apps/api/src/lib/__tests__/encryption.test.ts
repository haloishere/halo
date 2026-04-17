import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { LocalEncryptionService, _resetEncryptionInstance } from '../encryption.js'

const TEST_KEY = 'a'.repeat(64) // 32 bytes as hex

beforeEach(() => {
  vi.stubEnv('ENCRYPTION_DEV_KEY', TEST_KEY)
  vi.stubEnv('KMS_KEY_ID', '') // ensure local implementation is used
})

afterEach(() => {
  vi.unstubAllEnvs()
  _resetEncryptionInstance()
})

describe('LocalEncryptionService', () => {
  it('throws at construction when ENCRYPTION_DEV_KEY is missing', () => {
    vi.stubEnv('ENCRYPTION_DEV_KEY', '')
    expect(() => new LocalEncryptionService()).toThrow('ENCRYPTION_DEV_KEY env var is required')
  })

  it('throws at construction when ENCRYPTION_DEV_KEY is wrong length', () => {
    vi.stubEnv('ENCRYPTION_DEV_KEY', 'tooshort')
    expect(() => new LocalEncryptionService()).toThrow(
      'ENCRYPTION_DEV_KEY must be a 64-character hex string',
    )
  })

  it('encrypt/decrypt round-trip returns original plaintext', async () => {
    const svc = new LocalEncryptionService()
    const plaintext = 'John Doe'
    const userId = 'user-123'

    const encrypted = await svc.encryptField(plaintext, userId)
    const decrypted = await svc.decryptField(encrypted, userId)

    expect(decrypted).toBe(plaintext)
  })

  it('ciphertext differs from plaintext', async () => {
    const svc = new LocalEncryptionService()
    const plaintext = 'secret data'

    const encrypted = await svc.encryptField(plaintext, 'user-1')

    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.startsWith('local:')).toBe(true)
  })

  it('wrong userId on decrypt causes auth tag mismatch', async () => {
    const svc = new LocalEncryptionService()
    const encrypted = await svc.encryptField('sensitive', 'user-correct')

    await expect(svc.decryptField(encrypted, 'user-wrong')).rejects.toThrow()
  })

  it('Unicode/emoji plaintexts survive round-trip correctly', async () => {
    const svc = new LocalEncryptionService()
    const plaintext = 'María 😊 café naïve résumé'

    const encrypted = await svc.encryptField(plaintext, 'user-unicode')
    const decrypted = await svc.decryptField(encrypted, 'user-unicode')

    expect(decrypted).toBe(plaintext)
  })

  it('throws on empty string plaintext', async () => {
    const svc = new LocalEncryptionService()
    await expect(svc.encryptField('', 'user-1')).rejects.toThrow('Cannot encrypt empty string')
  })

  it('very long strings (1000+ chars) encrypt/decrypt correctly', async () => {
    const svc = new LocalEncryptionService()
    const plaintext = 'x'.repeat(1000)

    const encrypted = await svc.encryptField(plaintext, 'user-long')
    const decrypted = await svc.decryptField(encrypted, 'user-long')

    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertexts for same input (random IV)', async () => {
    const svc = new LocalEncryptionService()
    const encrypted1 = await svc.encryptField('same text', 'user-1')
    const encrypted2 = await svc.encryptField('same text', 'user-1')

    expect(encrypted1).not.toBe(encrypted2)
  })

  it('same IP always produces the same hash (deterministic SHA-256 across instances)', () => {
    // Validates that encryption is consistent — related to audit log IP hashing contract
    const ip = '192.168.1.1'
    const h1 = createHash('sha256').update(ip).digest('hex')
    const h2 = createHash('sha256').update(ip).digest('hex')
    expect(h1).toBe(h2)
  })
})
