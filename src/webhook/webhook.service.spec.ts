import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_secret'),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should return true for a valid signature', () => {
      const payload = Buffer.from('test_payload');
      const hmac = crypto.createHmac('sha256', 'test_secret');
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = service.verifySignature(signature, payload);
      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const payload = Buffer.from('test_payload');
      const signature = 'sha256=invalid_signature';

      const result = service.verifySignature(signature, payload);
      expect(result).toBe(false);
    });

    it('should return false for a missing signature', () => {
        const payload = Buffer.from('test_payload');
        const result = service.verifySignature(null, payload);
        expect(result).toBe(false);
    });

    it('should return false for a malformed signature', () => {
        const payload = Buffer.from('test_payload');
        const signature = 'sha1=some_signature';
        const result = service.verifySignature(signature, payload);
        expect(result).toBe(false);
    });
  });
});