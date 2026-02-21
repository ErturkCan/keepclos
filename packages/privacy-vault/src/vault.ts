import { EncryptedRecord, EncryptionError } from '@keepclos/shared';
import { encryptString, decryptString, encryptObject, decryptObject, hashPassword, verifyPassword } from './encrypt.js';

/**
 * Vault manager for storing and retrieving encrypted records
 * Supports per-field encryption and master password protection
 */

export interface VaultRecord {
  id: string;
  data: Record<string, EncryptedRecord>; // Field name to encrypted value
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultConfig {
  masterPassword?: string;
  enableFieldEncryption: boolean;
}

/**
 * In-memory vault implementation
 * Production use should extend this with persistent storage
 */
export class Vault {
  private records: Map<string, VaultRecord>;
  private config: VaultConfig;
  private masterPassword: string;
  private masterPasswordHash?: { hash: string; salt: string };

  constructor(config: Partial<VaultConfig> = {}) {
    this.records = new Map();
    this.config = {
      enableFieldEncryption: true,
      ...config,
    };
    this.masterPassword = config.masterPassword || this.generateMasterPassword();
  }

  /**
   * Set or change master password
   * @param password New master password
   */
  setMasterPassword(password: string): void {
    this.masterPassword = password;
    this.masterPasswordHash = hashPassword(password);
  }

  /**
   * Verify master password
   * @param password Password to verify
   * @returns true if correct
   */
  verifyMasterPassword(password: string): boolean {
    if (!this.masterPasswordHash) {
      return password === this.masterPassword;
    }
    return verifyPassword(password, this.masterPasswordHash.hash, this.masterPasswordHash.salt);
  }

  /**
   * Store an encrypted record
   * @param id Record ID
   * @param data Object to store
   * @returns Stored record
   */
  store<T extends Record<string, string>>(id: string, data: T): VaultRecord {
    const now = new Date();
    const encryptedFields: Record<string, EncryptedRecord> = {};

    // Encrypt each field
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        encryptedFields[key] = encryptString(value, this.masterPassword);
      }
    }

    const record: VaultRecord = {
      id,
      data: encryptedFields,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(id, record);
    return record;
  }

  /**
   * Retrieve and decrypt a record
   * @param id Record ID
   * @param password Password for decryption (uses master password if not provided)
   * @returns Decrypted data
   */
  retrieve<T extends Record<string, string>>(id: string, password?: string): T {
    const record = this.records.get(id);
    if (!record) {
      throw new EncryptionError(`Record not found: ${id}`);
    }

    const finalPassword = password || this.masterPassword;
    const decryptedData: Record<string, string> = {};

    for (const [key, encrypted] of Object.entries(record.data)) {
      try {
        decryptedData[key] = decryptString(encrypted, finalPassword);
      } catch (error) {
        throw new EncryptionError(`Failed to decrypt field '${key}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return decryptedData as T;
  }

  /**
   * Store a JSON object with encryption
   * @param id Record ID
   * @param data Object to store
   * @returns Stored record
   */
  storeObject<T>(id: string, data: T): VaultRecord {
    const now = new Date();
    const encrypted = encryptObject(data, this.masterPassword);

    const record: VaultRecord = {
      id,
      data: {
        __object: encrypted,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(id, record);
    return record;
  }

  /**
   * Retrieve a stored JSON object
   * @param id Record ID
   * @param password Optional password override
   * @returns Decrypted object
   */
  retrieveObject<T>(id: string, password?: string): T {
    const record = this.records.get(id);
    if (!record) {
      throw new EncryptionError(`Record not found: ${id}`);
    }

    if (!record.data.__object) {
      throw new EncryptionError(`Record is not a stored object: ${id}`);
    }

    const finalPassword = password || this.masterPassword;

    try {
      return decryptObject<T>(record.data.__object, finalPassword);
    } catch (error) {
      throw new EncryptionError(`Failed to decrypt object: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a stored record
   * @param id Record ID
   * @param data New data
   * @returns Updated record
   */
  update<T extends Record<string, string>>(id: string, data: T): VaultRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new EncryptionError(`Record not found: ${id}`);
    }

    // Re-encrypt with new data
    const encryptedFields: Record<string, EncryptedRecord> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        encryptedFields[key] = encryptString(value, this.masterPassword);
      }
    }

    record.data = encryptedFields;
    record.updatedAt = new Date();

    this.records.set(id, record);
    return record;
  }

  /**
   * Delete a record
   * @param id Record ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): boolean {
    return this.records.delete(id);
  }

  /**
   * Check if record exists
   * @param id Record ID
   * @returns true if exists
   */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /**
   * Get all record IDs
   * @returns Array of record IDs
   */
  getAllIds(): string[] {
    return Array.from(this.records.keys());
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Export vault to JSON (encrypted, for backup)
   * @returns JSON string with all encrypted data
   */
  export(): string {
    const data: Record<string, VaultRecord> = {};

    for (const [id, record] of this.records.entries()) {
      data[id] = record;
    }

    return JSON.stringify(data);
  }

  /**
   * Import vault from JSON
   * @param jsonData JSON string from export()
   */
  import(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData) as Record<string, VaultRecord>;

      for (const [id, record] of Object.entries(data)) {
        this.records.set(id, {
          ...record,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        });
      }
    } catch (error) {
      throw new EncryptionError(`Failed to import vault: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get vault statistics
   */
  getStats(): {
    recordCount: number;
    recordIds: string[];
    oldestRecord?: Date;
    newestRecord?: Date;
  } {
    const records = Array.from(this.records.values());
    const dates = records.map((r) => r.createdAt).sort((a, b) => a.getTime() - b.getTime());

    return {
      recordCount: records.length,
      recordIds: Array.from(this.records.keys()),
      oldestRecord: dates.length > 0 ? dates[0] : undefined,
      newestRecord: dates.length > 0 ? dates[dates.length - 1] : undefined,
    };
  }

  /**
   * Generate a random master password
   */
  private generateMasterPassword(): string {
    return Buffer.from(require('crypto').randomBytes(32)).toString('hex');
  }
}

/**
 * Contact field encryption helper
 * Encrypts sensitive contact fields individually
 */
export class ContactVault {
  private vault: Vault;
  private fieldNames: string[];

  constructor(masterPassword?: string, fieldsToEncrypt: string[] = ['email', 'phone']) {
    this.vault = new Vault({ masterPassword, enableFieldEncryption: true });
    this.fieldNames = fieldsToEncrypt;
  }

  /**
   * Store contact with encrypted fields
   * @param contactId Contact ID
   * @param contact Contact data
   */
  storeContact(contactId: string, contact: Record<string, string>): void {
    const dataToStore: Record<string, string> = {};

    for (const [key, value] of Object.entries(contact)) {
      if (this.fieldNames.includes(key) && value) {
        // These fields will be encrypted by vault.store()
        dataToStore[key] = value;
      }
    }

    this.vault.store(`contact:${contactId}`, dataToStore);
  }

  /**
   * Retrieve contact with decryption
   * @param contactId Contact ID
   * @returns Decrypted contact data
   */
  retrieveContact(contactId: string): Record<string, string> {
    return this.vault.retrieve(`contact:${contactId}`);
  }
}
