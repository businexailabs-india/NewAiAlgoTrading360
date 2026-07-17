import crypto from 'crypto';

const KEY_VERSION = parseInt(process.env.ENCRYPTION_KEY_VERSION || '1', 10);
const LEGACY_PASSPHRASE = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

function deriveKey(version = KEY_VERSION): Buffer {
  const material = process.env[`ENCRYPTION_KEY_V${version}`] || process.env.ENCRYPTION_KEY || LEGACY_PASSPHRASE;
  return crypto.createHash('sha256').update(`${material}:v${version}`).digest();
}

/**
 * AES-256-GCM credential encryption with key versioning.
 * Legacy CryptoJS AES payloads remain decryptable for migration.
 */
export class EncryptionService {
  static currentKeyVersion(): number {
    return KEY_VERSION;
  }

  static encrypt(text: string, version = KEY_VERSION): string {
    const iv = crypto.randomBytes(12);
    const key = deriveKey(version);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v${version}:gcm:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';

    if (encryptedText.startsWith('v') && encryptedText.includes(':gcm:')) {
      const match = encryptedText.match(/^v(\d+):gcm:([^:]+):([^:]+):(.+)$/);
      if (!match) {
        throw new Error('Invalid encrypted payload');
      }
      const [, versionStr, ivB64, tagB64, dataB64] = match;
      if (!versionStr || !ivB64 || !tagB64 || !dataB64) {
        throw new Error('Invalid encrypted payload');
      }
      const version = parseInt(versionStr, 10);
      const key = deriveKey(version);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    }

    // Legacy CryptoJS AES (passphrase) fallback
    try {
      // Lazy require to avoid hard dependency if unused
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const CryptoJS = require('crypto-js');
      const bytes = CryptoJS.AES.decrypt(encryptedText, LEGACY_PASSPHRASE);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      throw new Error('Failed to decrypt credential');
    }
  }

  static encryptJson(value: unknown, version = KEY_VERSION): string {
    return this.encrypt(JSON.stringify(value ?? {}), version);
  }

  static decryptJson<T = Record<string, unknown>>(encryptedText: string | null | undefined): T | null {
    if (!encryptedText) return null;
    const raw = this.decrypt(encryptedText);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  static maskSecret(value?: string | null, visible = 4): string {
    if (!value) return '';
    if (value.length <= visible) return '*'.repeat(value.length);
    return `${'*'.repeat(Math.max(4, value.length - visible))}${value.slice(-visible)}`;
  }

  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  static generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
