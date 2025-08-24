import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly appSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    if (!secret) {
      throw new Error(
        'FACEBOOK_APP_SECRET is not defined in environment variables'
      );
    }
    this.appSecret = secret;
  }

  /**
   * Xác thực chữ ký của payload webhook từ Facebook.
   * @param signature Chữ ký từ header 'X-Hub-Signature-256'.
   * @param payload Body của request dưới dạng raw buffer.
   * @returns `true` nếu chữ ký hợp lệ, ngược lại `false`.
   */
  verifySignature(signature: string, payload: Buffer): boolean {
    if (!signature) {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      return false;
    }

    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      this.logger.warn('Invalid signature format');
      return false;
    }

    const expectedSignature = parts[1];
    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('hex');

    if (calculatedSignature !== expectedSignature) {
      this.logger.warn('Signature validation failed');
      return false;
    }

    return true;
  }
}
