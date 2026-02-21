import crypto from 'crypto';
import { EncryptedRecord, EncryptionError } from '@keepclos/shared';

/**
 * AES-256-GCM encryption utilities for privacy-sensitive data
 * Uses PBKDF2 for key derivation from passwords
 */

export const ALGORITHM = 'aes-256-gcm';
export const KEY_LENGTH = 32; // 256 bits
export const IV_LENGTH = 16; // 128 bits for GCM
export const AUTH_TAG_LENGTH = 16; // 128 bits
export const SALT_LENGTH = 16; // 128 bits
export const PBKDF2_ITERATIONS = 100000;
export const PBKDF2_DIGEST = 'sha256';

/**
 * Derive encryption key from password using PBKDF2
 * @param password User password
 * @param salt Salt for key derivation
 * @param iterations Number of iterations (higher = slower but more secure)
 * @returns Derived key buffer
 */
export function deriveKey(
  password: string,
  salt: Buffer,
  iterations: number = PBKDF2_ITERATIONS,
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Generate a random salt for key derivation
 * @returns Random salt buffer
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Generate a random IV (initialization vector) for encryption
 * @returns Random IV buffer
 */
export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Encrypt a string with AES-256-GCM
 * @param plaintext Text to encrypt
 * @param password Password for key derivation
 * @returns Encrypted record with IV and salt
 */
export function encryptString(plaintext: string, password: string): EncryptedRecord {
  try {
    const salt = generateSalt();
    const iv = generateIV();
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      algorithm: ALGORITHM,
      authTag: authTag.toString('base64'),
    };
  } catch (error) {
    throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt a string encrypted with encryptString
 * @param record Encrypted record
 * @param password Password for key derivation
 * @returns Decrypted plaintext
 */
export function decryptString(record: EncryptedRecord, password: string): string {
  try {
    const salt = Buffer.from(record.salt, 'base64');
    const iv = Buffer.from(record.iv, 'base64');
    const authTag = Buffer.from(record.authTag, 'base64');
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(record.encryptedData, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  } catch (error) {
    throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encrypt a JSON object
 * @param data Object to encrypt
 * @param password Password for key derivation
 * @returns Encrypted record
 */
export function encryptObject<T>(data: T, password: string): EncryptedRecord {
  const plaintext = JSON.stringify(data);
  return encryptString(plaintext, password);
}

/**
 * Decrypt a JSON object
 * @param record Encrypted record
 * @param password Password for key derivation
 * @returns Decrypted object
 */
export function decryptObject<T>(record: EncryptedRecord, password: string): T {
  const plaintext = decryptString(record, password);
  try {
    return JSON.parse(plaintext) as T;
  } catch (error) {
    throw new EncryptionError(`Failed to parse decrypted JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encrypt a buffer of binary data
 * @param data Binary data to encrypt
 * @param password Password for key derivation
 * @returns Encrypted record
 */
export function encryptBuffer(data: Buffer, password: string): EncryptedRecord {
  try {
    const salt = generateSalt();
    const iv = generateIV();
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(data).toString('hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      algorithm: ALGORITHM,
      authTag: authTag.toString('base64'),
    };
  } catch (error) {
    throw new EncryptionError(`Buffer encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt a buffer encrypted with encryptBuffer
 * @param record Encrypted record
 * @param password Password for key derivation
 * @returns Decrypted buffer
 */
export function decryptBuffer(record: EncryptedRecord, password: string): Buffer {
  try {
    const salt = Buffer.from(record.salt, 'base64');
    const iv = Buffer.from(record.iv, 'base64');
    const authTag = Buffer.from(record.authTag, 'base64');
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(record.encryptedData, 'hex');
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  } catch (error) {
    throw new EncryptionError(`Buffer decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Hash a password using PBKDF2 (for storage, not encryption key)
 * @param password Password to hash
 * @param salt Optional salt (generated if not provided)
 * @returns Object with hash and salt
 */
export function hashPassword(password: string, salt?: Buffer): { hash: string; salt: string } {
  const finalSalt = salt ?? generateSalt();
  const hash = crypto.pbkdf2Sync(password, finalSalt, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);

  return {
    hash: hash.toString('base64'),
    salt: finalSalt.toString('base64'),
  };
}

/**
 * Verify a password against a stored hash
 * @param password Password to verify
 * @param hash Stored hash
 * @param salt Stored salt
 * @returns true if password matches
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const saltBuffer = Buffer.from(salt, 'base64');
    const newHash = crypto.pbkdf2Sync(password, saltBuffer, PBKDF2_ITERATIONS, 32, PBKDF2_DIGEST);
    const hashBuffer = Buffer.from(hash, 'base64');

    return crypto.timingSafeEqual(newHash, hashBuffer);
  } catch (error) {
    return false;
  }
}
