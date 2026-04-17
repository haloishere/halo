import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

export interface EncryptionService {
  encryptField(plaintext: string, userId: string): Promise<string>
  decryptField(ciphertext: string, userId: string): Promise<string>
}

// ─── Local (dev/test) implementation ───────────────────────────────────────
// AES-256-GCM with per-field random IV and userId-derived AAD for context isolation.
// NOT safe as the sole protection for production PHI — use KmsEncryptionService in prod.
export class LocalEncryptionService implements EncryptionService {
  private readonly key: Buffer

  constructor() {
    const devKey = process.env.ENCRYPTION_DEV_KEY
    if (!devKey) {
      throw new Error(
        'ENCRYPTION_DEV_KEY env var is required for LocalEncryptionService. ' +
          'Generate one with: openssl rand -hex 32',
      )
    }
    this.key = Buffer.from(devKey, 'hex')
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_DEV_KEY must be a 64-character hex string (32 bytes).')
    }
  }

  async encryptField(plaintext: string, userId: string): Promise<string> {
    if (plaintext === '') {
      throw new Error('Cannot encrypt empty string')
    }

    const iv = randomBytes(12) // 96-bit IV for GCM
    const aad = this.deriveAad(userId)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(aad)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    // Format: local:<iv_hex>:<tag_hex>:<ciphertext_hex>
    return `local:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
  }

  async decryptField(ciphertext: string, userId: string): Promise<string> {
    const parts = ciphertext.split(':')
    if (parts.length !== 4 || parts[0] !== 'local') {
      throw new Error('Invalid ciphertext format')
    }

    const iv = Buffer.from(parts[1] as string, 'hex')
    const tag = Buffer.from(parts[2] as string, 'hex')
    const encrypted = Buffer.from(parts[3] as string, 'hex')
    const aad = this.deriveAad(userId)

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  }

  private deriveAad(userId: string): Buffer {
    // Tie ciphertext to userId — decryption with wrong userId will fail auth tag check
    return createHash('sha256').update(userId).digest()
  }
}

// ─── Cloud KMS implementation ───────────────────────────────────────────────
// Envelope encryption: KEK in Cloud KMS, per-field random DEK encrypted by KEK.
// Format: kms:<encrypted_dek_b64>:<iv_hex>:<tag_hex>:<ciphertext_hex>
export class KmsEncryptionService implements EncryptionService {
  private readonly kmsKeyName: string
  // Lazy-loaded KMS client — reused across calls to avoid gRPC channel churn
  private kmsClient: Awaited<ReturnType<typeof KmsEncryptionService.prototype.loadClient>> | null =
    null

  constructor() {
    const kmsKeyName = process.env.KMS_KEY_ID
    if (!kmsKeyName) {
      throw new Error('KMS_KEY_ID env var is required for KmsEncryptionService.')
    }
    this.kmsKeyName = kmsKeyName
  }

  private async loadClient() {
    const { KeyManagementServiceClient } = await import('@google-cloud/kms')
    return new KeyManagementServiceClient()
  }

  private async getClient() {
    if (!this.kmsClient) {
      this.kmsClient = await this.loadClient()
    }
    return this.kmsClient
  }

  async encryptField(plaintext: string, userId: string): Promise<string> {
    const client = await this.getClient()

    // Generate a random 32-byte DEK
    const dek = randomBytes(32)
    const iv = randomBytes(12)

    try {
      // Encrypt DEK with KEK via Cloud KMS
      const [encryptResponse] = await client.encrypt({
        name: this.kmsKeyName,
        plaintext: dek,
      })
      const encryptedDek = Buffer.from(encryptResponse.ciphertext as Uint8Array).toString('base64')

      // Encrypt plaintext with DEK using AES-256-GCM
      const aad = Buffer.from(userId, 'utf8')
      const cipher = createCipheriv('aes-256-gcm', dek, iv)
      cipher.setAAD(aad)
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()

      return `kms:${encryptedDek}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
    } finally {
      dek.fill(0)
    }
  }

  async decryptField(ciphertext: string, userId: string): Promise<string> {
    const parts = ciphertext.split(':')
    if (parts.length !== 5 || parts[0] !== 'kms') {
      throw new Error('Invalid KMS ciphertext format')
    }

    const client = await this.getClient()
    const encryptedDek = Buffer.from(parts[1] as string, 'base64')

    const [decryptResponse] = await client.decrypt({
      name: this.kmsKeyName,
      ciphertext: encryptedDek,
    })
    const dek = Buffer.from(decryptResponse.plaintext as Uint8Array)

    try {
      const iv = Buffer.from(parts[2] as string, 'hex')
      const tag = Buffer.from(parts[3] as string, 'hex')
      const encrypted = Buffer.from(parts[4] as string, 'hex')
      const aad = Buffer.from(userId, 'utf8')

      const decipher = createDecipheriv('aes-256-gcm', dek, iv)
      decipher.setAAD(aad)
      decipher.setAuthTag(tag)

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    } finally {
      dek.fill(0)
    }
  }
}

// ─── Singleton export (lazy-initialized) ───────────────────────────────────
// Lazy initialization avoids constructor failure at module import time in test
// environments where env vars are injected after module load via vi.stubEnv.
let _encryptionInstance: EncryptionService | null = null

function getEncryptionInstance(): EncryptionService {
  if (!_encryptionInstance) {
    _encryptionInstance = process.env.KMS_KEY_ID
      ? new KmsEncryptionService()
      : new LocalEncryptionService()
  }
  return _encryptionInstance
}

export const encryption: EncryptionService = {
  encryptField: (plaintext, userId) => getEncryptionInstance().encryptField(plaintext, userId),
  decryptField: (ciphertext, userId) => getEncryptionInstance().decryptField(ciphertext, userId),
}

/** Reset the cached singleton — used in tests that change env vars between tests. */
export function _resetEncryptionInstance(): void {
  _encryptionInstance = null
}
