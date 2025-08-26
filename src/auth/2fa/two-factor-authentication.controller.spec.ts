import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorAuthenticationController } from './two-factor-authentication.controller';
import { TwoFactorAuthenticationService } from './two-factor-authentication.service';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('TwoFactorAuthenticationController', () => {
  let controller: TwoFactorAuthenticationController;
  let twoFactorAuthService: jest.Mocked<TwoFactorAuthenticationService>;
  let userService: jest.Mocked<UserService>;
  let authService: jest.Mocked<AuthService>;
  let encryptionService: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwoFactorAuthenticationController],
      providers: [
        {
          provide: TwoFactorAuthenticationService,
          useValue: {
            generateSecret: jest.fn(),
            generateQrCodeDataURL: jest.fn(),
            isCodeValid: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            turnOnTwoFactorAuthentication: jest.fn(),
            findOneById: jest.fn(),
            turnOffTwoFactorAuthentication: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TwoFactorAuthenticationController>(TwoFactorAuthenticationController);
    twoFactorAuthService = module.get(TwoFactorAuthenticationService);
    userService = module.get(UserService);
    authService = module.get(AuthService);
    encryptionService = module.get(EncryptionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a QR code and set a cookie', async () => {
      const user = { id: 'userId' };
      const secret = 'secret';
      const otpAuthUrl = 'otpAuthUrl';
      const qrCodeDataURL = 'qrCodeDataURL';
      const encryptedSecret = 'encryptedSecret';
      const res = {
        cookie: jest.fn(),
        json: jest.fn(),
      };
      twoFactorAuthService.generateSecret.mockResolvedValue({ secret, otpAuthUrl });
      twoFactorAuthService.generateQrCodeDataURL.mockResolvedValue(qrCodeDataURL);
      encryptionService.encrypt.mockReturnValue(encryptedSecret);

      await controller.generate({ user } as any, res as any);

      expect(res.cookie).toHaveBeenCalledWith('2fa_secret', encryptedSecret, expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ qrCodeDataURL });
    });
  });

  describe('turnOn', () => {
    it('should throw BadRequestException if cookie is not found', async () => {
      const req = { cookies: {} };
      await expect(controller.turnOn(req as any, { code: '123456' })).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if code is invalid', async () => {
        const req = { cookies: { '2fa_secret': 'encryptedSecret' }, user: {id: '123'} };
        encryptionService.decrypt.mockReturnValue('secret');
        twoFactorAuthService.isCodeValid.mockReturnValue(false);

        await expect(controller.turnOn(req as any, { code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should turn on 2fa and return recovery codes', async () => {
        const req = { cookies: { '2fa_secret': 'encryptedSecret' }, user: { id: 'userId' } };
        const recoveryCodes = ['code1', 'code2'];
        encryptionService.decrypt.mockReturnValue('secret');
        twoFactorAuthService.isCodeValid.mockReturnValue(true);
        userService.turnOnTwoFactorAuthentication.mockResolvedValue({ user: {} as any, recoveryCodes });

        const result = await controller.turnOn(req as any, { code: '123456' });

        expect(result).toEqual({ message: 'Two-factor authentication has been enabled successfully.', recoveryCodes });
    });
  });

  describe('authenticate', () => {
    it('should throw ForbiddenException if 2fa is not enabled', async () => {
        const user = { id: 'userId', isTwoFactorAuthenticationEnabled: false };
        userService.findOneById.mockResolvedValue(user as any);

        await expect(controller.authenticate({ user } as any, { code: '123456' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if code is invalid', async () => {
        const user = { id: 'userId', isTwoFactorAuthenticationEnabled: true, twoFactorAuthenticationSecret: 'secret' };
        userService.findOneById.mockResolvedValue(user as any);
        encryptionService.decrypt.mockReturnValue('decryptedSecret');
        twoFactorAuthService.isCodeValid.mockReturnValue(false);

        await expect(controller.authenticate({ user } as any, { code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens if code is valid', async () => {
        const user = { id: 'userId', isTwoFactorAuthenticationEnabled: true, twoFactorAuthenticationSecret: 'secret' };
        const tokens = { accessToken: 'access', refreshToken: 'refresh' };
        userService.findOneById.mockResolvedValue(user as any);
        encryptionService.decrypt.mockReturnValue('decryptedSecret');
        twoFactorAuthService.isCodeValid.mockReturnValue(true);
        authService.login.mockResolvedValue(tokens);

        const result = await controller.authenticate({ user } as any, { code: '123456' });

        expect(result).toEqual(tokens);
    });
  });

  describe('turnOff', () => {
    it('should throw UnauthorizedException if password is wrong', async () => {
        const user = { id: 'userId', passwordHash: 'hashedPassword' };
        userService.findOneById.mockResolvedValue(user as any);
        // mock bcrypt.compare to return false
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

        await expect(controller.turnOff({ user } as any, { password: 'wrongPassword' })).rejects.toThrow(UnauthorizedException);
    });

    it('should turn off 2fa if password is correct', async () => {
        const user = { id: 'userId', passwordHash: 'hashedPassword' };
        userService.findOneById.mockResolvedValue(user as any);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

        const result = await controller.turnOff({ user } as any, { password: 'correctPassword' });

        expect(result).toEqual({ message: 'Two-factor authentication has been disabled.' });
        expect(userService.turnOffTwoFactorAuthentication).toHaveBeenCalledWith('userId');
    });
  });
});
