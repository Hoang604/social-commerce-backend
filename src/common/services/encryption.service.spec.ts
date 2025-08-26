import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PAGE_TOKEN_ENCRYPTION_KEY') return '12345678901234567890123456789012'; // 32 chars
      return null;
    }),
  };

  beforeEach(() => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'PAGE_TOKEN_ENCRYPTION_KEY') return '12345678901234567890123456789012'; // 32 chars
      return null;
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const text = 'my secret text';
      const encrypted = service.encrypt(text);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toEqual(text);
      expect(decrypted).toEqual(text);
    });

    it('should return a string in the correct format', () => {
        const text = 'my secret text';
        const encrypted = service.encrypt(text);
        const parts = encrypted.split(':');
        expect(parts.length).toBe(3);
    });

    it('should throw an error for invalid encrypted text format', () => {
        const invalidEncryptedText = 'invalid-text';
        expect(() => service.decrypt(invalidEncryptedText)).toThrow('Could not decrypt token.');
    });
  });

  describe('constructor', () => {
    it('should throw an error if encryption key is not configured', () => {
        mockConfigService.get.mockReturnValue(null);
        expect(() => new EncryptionService(mockConfigService as any)).toThrow('PAGE_TOKEN_ENCRYPTION_KEY must be defined in .env and be 32 characters long.');
    });

    it('should throw an error if encryption key is not 32 characters long', () => {
        mockConfigService.get.mockReturnValue('short-key');
        expect(() => new EncryptionService(mockConfigService as any)).toThrow('PAGE_TOKEN_ENCRYPTION_KEY must be defined in .env and be 32 characters long.');
    });
  });
});
