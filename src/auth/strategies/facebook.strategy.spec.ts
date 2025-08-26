import { Test, TestingModule } from '@nestjs/testing';
import { FacebookStrategy } from './facebook.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('FacebookStrategy', () => {
  let strategy: FacebookStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'FACEBOOK_APP_ID') return 'test-id';
      if (key === 'FACEBOOK_APP_SECRET') return 'test-secret';
      if (key === 'FACEBOOK_LOGIN_CALLBACK_URL') return 'test-callback';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: {
            validateSocialLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<FacebookStrategy>(FacebookStrategy);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should call authService.validateSocialLogin with correct parameters and call done', async () => {
      const profile = {
        id: '123',
        name: { givenName: 'Test', familyName: 'User' },
        emails: [{ value: 'test@example.com' }],
        photos: [{ value: 'test-photo-url' }],
      };
      const user = { id: 'userId' };
      authService.validateSocialLogin.mockResolvedValue(user as any);
      const done = jest.fn();

      await strategy.validate('accessToken', 'refreshToken', profile as any, done);

      expect(authService.validateSocialLogin).toHaveBeenCalledWith({
        provider: 'facebook',
        providerId: '123',
        email: 'test@example.com',
        fullName: 'Test User',
        avatarUrl: 'test-photo-url',
      });
      expect(done).toHaveBeenCalledWith(null, user);
    });
  });

  describe('constructor', () => {
    it('should throw InternalServerErrorException if credentials are not configured', () => {
        mockConfigService.get.mockReturnValue(null);
        expect(() => new FacebookStrategy(mockConfigService as any, authService as any)).toThrow(InternalServerErrorException);
    });
  });
});
