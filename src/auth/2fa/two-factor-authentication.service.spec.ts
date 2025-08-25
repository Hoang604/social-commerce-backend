
import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorAuthenticationService } from './two-factor-authentication.service';
import { UserService } from '../../user/user.service';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/services/encryption.service';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';

jest.mock('otplib');
jest.mock('qrcode');

describe('TwoFactorAuthenticationService', () => {
  let service: TwoFactorAuthenticationService;
  let userService: jest.Mocked<UserService>;
  let configService: jest.Mocked<ConfigService>;
  let encryptionService: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorAuthenticationService,
        {
          provide: UserService,
          useValue: {
            
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorAuthenticationService>(TwoFactorAuthenticationService);
    userService = module.get(UserService);
    configService = module.get(ConfigService);
    encryptionService = module.get(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecret', () => {
    it('should generate a secret and an otpAuthUrl', async () => {
      const user = { email: 'test@example.com' } as any;
      const secret = 'testsecret';
      const appName = 'TestApp';
      const otpAuthUrl = 'otpauth://test';

      (authenticator.generateSecret as jest.Mock).mockReturnValue(secret);
      (configService.get as jest.Mock).mockReturnValue(appName);
      (authenticator.keyuri as jest.Mock).mockReturnValue(otpAuthUrl);

      const result = await service.generateSecret(user);

      expect(result).toEqual({ secret, otpAuthUrl });
      expect(authenticator.generateSecret).toHaveBeenCalled();
      expect(configService.get).toHaveBeenCalledWith('TWO_FACTOR_APP_NAME', 'SocialCommerce');
      expect(authenticator.keyuri).toHaveBeenCalledWith(user.email, appName, secret);
    });
  });

  describe('generateQrCodeDataURL', () => {
    it('should generate a QR code data URL', async () => {
      const otpAuthUrl = 'otpauth://test';
      const dataUrl = 'data:image/png;base64,test';

      (toDataURL as jest.Mock).mockResolvedValue(dataUrl);

      const result = await service.generateQrCodeDataURL(otpAuthUrl);

      expect(result).toBe(dataUrl);
      expect(toDataURL).toHaveBeenCalledWith(otpAuthUrl);
    });
  });

  describe('isCodeValid', () => {
    it('should return true if the code is valid', () => {
      const code = '123456';
      const secret = 'testsecret';

      (authenticator.verify as jest.Mock).mockReturnValue(true);

      const result = service.isCodeValid(code, secret);

      expect(result).toBe(true);
      expect(authenticator.verify).toHaveBeenCalledWith({ token: code, secret });
    });

    it('should return false if the code is invalid', () => {
      const code = '123456';
      const secret = 'testsecret';

      (authenticator.verify as jest.Mock).mockReturnValue(false);

      const result = service.isCodeValid(code, secret);

      expect(result).toBe(false);
      expect(authenticator.verify).toHaveBeenCalledWith({ token: code, secret });
    });
  });
});
