import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = 'hr-backend-encryption-salt';

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'ENCRYPTION_KEY belum diisi di environment. Wajib diisi untuk menyimpan data sensitif ' +
        '(NIK, NPWP, no. rekening) sesuai checklist §7 backend-architecture-hr.md.',
    );
  }
  cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

/**
 * TypeORM ValueTransformer untuk enkripsi at-rest (AES-256-GCM) pada kolom
 * data sensitif (nik, npwp, bank_account_no di entity Employee).
 * Tipe kolom database tetap varchar — hanya isinya yang dienkripsi di
 * application layer, jadi tidak mengubah skema §5.2.
 */
export const encryptedColumn: ValueTransformer = {
  to(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  },
  from(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    const raw = Buffer.from(value, 'base64');
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  },
};
