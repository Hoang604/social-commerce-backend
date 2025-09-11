import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * @Injectable
 * A service for encrypting and decrypting text, primarily for sensitive data like access tokens.
 * Uses AES-256-GCM algorithm for authenticated encryption.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // For GCM, IV is typically 12 or 16 bytes
  private readonly authTagLength = 16;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!secretKey || secretKey.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must be defined in .env and be 32 characters long.'
      );
    }
    this.key = Buffer.from(secretKey, 'utf-8');
  }

  /**
   * Encrypts a plaintext string.
   * @param text The plaintext to encrypt.
   * @returns A string containing the IV, auth tag, and encrypted text, separated by colons.
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted text into a single string for storage
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a string that was encrypted with the encrypt method.
   * @param encryptedText The encrypted string (IV:authTag:encrypted).
   * @returns The original plaintext string.
   */
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      // Log the error or handle it as needed, but avoid exposing details.
      console.error('Decryption failed:', error);
      throw new Error('Could not decrypt token.');
    }
  }
}
