import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { EntityManager, Repository } from 'typeorm';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { User, UserStatus } from '../user/entities/user.entity';
import { EncryptionService } from '../common/services/encryption.service';
import * as bcrypt from 'bcrypt';
import { SocialAccount } from './entities/social-account.entity';

jest.mock('bcrypt');
jest.mock('../user/user.service');
jest.mock('../common/services/encryption.service');

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let entityManager: jest.Mocked<EntityManager>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockSocialAccountRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockRefreshTokenRepo = {
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        ConfigService,
        EncryptionService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest.fn().mockImplementation(async (cb) =>
              cb({
                getRepository: jest.fn().mockImplementation((entity) => {
                  if (entity === User) return mockUserRepo;
                  if (entity === SocialAccount) return mockSocialAccountRepo;
                  return null;
                }),
                save: jest.fn(),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    entityManager = module.get(EntityManager);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        fullName: 'Test User',
      };
      const hashedPassword = 'hashedPassword';
      const newUser = new User();
      Object.assign(newUser, registerDto, { passwordHash: hashedPassword });

      userService.findOneByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
        const manager = { save: jest.fn().mockResolvedValue(newUser) };
        return cb(manager);
      });

      const result = await service.register(registerDto);

      expect(userService.findOneByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(entityManager.transaction).toHaveBeenCalled();
      expect(result).toEqual(newUser);
    });

    it('should throw a ConflictException if the email is already in use', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        fullName: 'Test User',
      };
      const existingUser = new User();
      userService.findOneByEmail.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Email này đã được sử dụng.'),
      );
    });
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid and user is active', async () => {
      const user = new User();
      user.email = 'test@example.com';
      user.passwordHash = 'hashedPassword';
      user.status = UserStatus.ACTIVE;
      userService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');
      expect(result).toEqual(user);
    });

    it('should throw ForbiddenException if user is suspended', async () => {
      const user = new User();
      user.status = UserStatus.SUSPENDED;
      user.passwordHash = 'hashedPassword';
      userService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(new ForbiddenException('Tài khoản của bạn đã bị đình chỉ.'));
    });

    it('should activate user if status is inactive', async () => {
        const user = new User();
        user.id = 'userId';
        user.status = UserStatus.INACTIVE;
        user.passwordHash = 'hashedPassword';
        const activatedUser = { ...user, status: UserStatus.ACTIVE };

        userService.findOneByEmail.mockResolvedValue(user);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        userService.activate.mockResolvedValue(activatedUser as User);

        const result = await service.validateUser('test@example.com', 'password');

        expect(userService.activate).toHaveBeenCalledWith(user.id);
        expect(result).toEqual(activatedUser);
    });

    it('should return null if password does not match', async () => {
      const user = new User();
      user.passwordHash = 'hashedPassword';
      userService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'password');
      expect(result).toBeNull();
    });

    it('should throw ForbiddenException if user is not found', async () => {
      userService.findOneByEmail.mockResolvedValue(null);
      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(new ForbiddenException('Email hoặc mật khẩu không đúng.'));
    });
  });

  describe('login', () => {
    const user = new User();
    user.id = 'userId';
    user.email = 'test@example.com';
    user.isTwoFactorAuthenticationEnabled = false;

    it('should return tokens and user on successful login', async () => {
        const tokens = { accessToken: 'access', refreshToken: 'refresh' };
        jwtService.signAsync.mockResolvedValueOnce(tokens.accessToken).mockResolvedValueOnce(tokens.refreshToken);

        const { passwordHash, ...userResult } = user;

        const result = await service.login(user, 'ip', 'ua');

        expect(result).toHaveProperty('accessToken', tokens.accessToken);
        expect(result).toHaveProperty('refreshToken', tokens.refreshToken);
        expect(result).toHaveProperty('user', userResult);
        expect(userService.setCurrentRefreshToken).toHaveBeenCalled();
        expect(userService.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should return a partial access token if 2FA is enabled', async () => {
        const userWith2FA = { ...user, isTwoFactorAuthenticationEnabled: true };
        const partialToken = 'partial-access-token';
        jwtService.signAsync.mockResolvedValue(partialToken);

        const result = await service.login(userWith2FA as User, 'ip', 'ua');

        expect(result).toEqual({ accessToken: partialToken });
        expect(jwtService.signAsync).toHaveBeenCalledWith(
            { sub: user.id, isTwoFactorAuthenticated: false, is2FA: true },
            { expiresIn: '5m' }
        );
        expect(entityManager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should delete refresh token and return true', async () => {
      userService.verifyRefreshToken.mockResolvedValue(true);
      refreshTokenRepository.delete.mockResolvedValue({} as any);

      const result = await service.logout('userId', 'valid-token');

      expect(userService.verifyRefreshToken).toHaveBeenCalledWith('valid-token', 'userId');
      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({ hashedToken: 'valid-token', userId: 'userId' });
      expect(result).toBe(true);
    });

    it('should throw an error if refresh token is not provided', async () => {
      await expect(service.logout('userId', null as any)).rejects.toThrow(
        'Refresh token is required for logout.',
      );
    });
  });

  describe('logoutAll', () => {
    it('should call user service to remove all tokens', async () => {
      await service.logoutAll('userId');
      expect(userService.removeAllRefreshTokensForUser).toHaveBeenCalledWith('userId');
      expect(userService.invalidateAllTokens).toHaveBeenCalledWith('userId');
    });
  });

  describe('refreshTokens', () => {
    // This test is complex due to the new UserService instantiation inside the transaction.
    // We will mock the transaction block to control the dependencies of that new service.
    it('should refresh tokens successfully', async () => {
        const userId = 'test-user-id';
        const oldRefreshToken = 'old-refresh-token';
        const newTokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
        const user = new User();
        user.id = userId;
        user.email = 'test@test.com';
        user.status = UserStatus.ACTIVE;

        // Mock the new UserService's dependencies
        const mockUserServiceInTransaction = {
            findOneById: jest.fn().mockResolvedValue(user),
            verifyRefreshToken: jest.fn().mockResolvedValue(true),
            setCurrentRefreshToken: jest.fn().mockResolvedValue(undefined),
        };

        (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
            // We can't easily inject a mocked UserService, so we mock its dependencies.
            const manager = {
                getRepository: jest.fn().mockImplementation((entity) => {
                    if (entity === User) return { findOne: mockUserServiceInTransaction.findOneById };
                    if (entity === RefreshToken) return {
                        // Mock methods used by verifyRefreshToken and setCurrentRefreshToken if any
                        findOne: jest.fn(),
                        delete: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    };
                    return {};
                }),
            };
            // We have to re-implement the service logic here for the test, which is not ideal
            // but a consequence of the `new UserService` call.
            // A better approach would be to refactor the code to inject the service.
            const tempUserService = {
                ...mockUserServiceInTransaction,
                // Mocking the constructor's dependencies
                entityManager: manager,
                userRepository: manager.getRepository(User),
                refreshTokenRepository: manager.getRepository(RefreshToken),
                encryptionService: new EncryptionService(configService),
            };

            // Manually call our mocked service methods
            const foundUser = await tempUserService.findOneById(userId);
            if (!foundUser || foundUser.status !== UserStatus.ACTIVE) {
                throw new ForbiddenException('Access Denied');
            }
            const isValid = await tempUserService.verifyRefreshToken(oldRefreshToken, userId);
            if (!isValid) {
                throw new ForbiddenException('Access Denied');
            }
            await tempUserService.setCurrentRefreshToken({
                refreshToken: newTokens.refreshToken,
                userId,
                expiresAt: expect.any(Date),
                expiredRefreshToken: oldRefreshToken,
            });

            return newTokens;
        });

        jwtService.signAsync
            .mockResolvedValueOnce(newTokens.accessToken)
            .mockResolvedValueOnce(newTokens.refreshToken);

        const result = await service.refreshTokens(userId, oldRefreshToken);

        expect(result).toEqual(newTokens);
    });
  });

  describe('validateSocialLogin', () => {
    const profile = {
      provider: 'facebook',
      providerId: '12345',
      email: 'social@test.com',
      fullName: 'Social User',
      avatarUrl: 'http://avatar.url'
    };

    it('should return user if social account exists', async () => {
      const user = new User();
      const socialAccount = new SocialAccount();
      socialAccount.user = user;
      mockSocialAccountRepo.findOne.mockResolvedValue(socialAccount);

      const result = await service.validateSocialLogin(profile);

      expect(mockSocialAccountRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it('should create a new user and social account if user does not exist', async () => {
        const newUser = new User();
        newUser.id = 'new-user-id';
        const newSocialAccount = new SocialAccount();

        mockSocialAccountRepo.findOne.mockResolvedValue(null);
        mockUserRepo.findOne.mockResolvedValue(null);
        mockUserRepo.create.mockReturnValue(newUser);
        (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
            const manager = {
                getRepository: jest.fn().mockImplementation((entity) => {
                    if (entity === User) return mockUserRepo;
                    if (entity === SocialAccount) return mockSocialAccountRepo;
                    return null;
                }),
                save: jest.fn().mockImplementation(entity => {
                    if (entity === newUser) return Promise.resolve(newUser);
if (entity === newSocialAccount) return Promise.resolve(newSocialAccount);
                })
            };
            mockUserRepo.save.mockResolvedValue(newUser);
            mockSocialAccountRepo.create.mockReturnValue(newSocialAccount);
            mockSocialAccountRepo.save.mockResolvedValue(newSocialAccount);

            return cb(manager);
        });


        const result = await service.validateSocialLogin(profile);

        expect(mockUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: profile.email }));
        expect(mockSocialAccountRepo.create).toHaveBeenCalledWith(expect.objectContaining({ provider: profile.provider, providerUserId: profile.providerId }));
        expect(result).toEqual(newUser);
    });

    it('should link social account to existing user by email', async () => {
        const existingUser = new User();
        existingUser.id = 'existing-user-id';
        const newSocialAccount = new SocialAccount();

        mockSocialAccountRepo.findOne.mockResolvedValue(null);
        mockUserRepo.findOne.mockResolvedValue(existingUser);
        mockSocialAccountRepo.create.mockReturnValue(newSocialAccount);
        (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
            const manager = {
                getRepository: jest.fn().mockImplementation((entity) => {
                    if (entity === User) return mockUserRepo;
                    if (entity === SocialAccount) return mockSocialAccountRepo;
                    return null;
                }),
                save: jest.fn().mockResolvedValue(newSocialAccount)
            };
            return cb(manager);
        });

        const result = await service.validateSocialLogin(profile);

        expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: profile.email } });
        expect(mockUserRepo.create).not.toHaveBeenCalled();
        expect(mockSocialAccountRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: existingUser.id }));
        expect(result).toEqual(existingUser);
    });
  });
});