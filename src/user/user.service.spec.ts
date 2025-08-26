import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserStatus } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';
import { TwoFactorRecoveryCode } from '../auth/entities/two-factor-recovery-code.entity';

import { EncryptionService } from '../common/services/encryption.service';
import * as crypto from 'crypto';

jest.mock('bcrypt');
jest.mock('../common/services/encryption.service');
jest.mock('crypto');

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let entityManager: jest.Mocked<EntityManager>;
  let encryptionService: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            preload: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest.fn(),
            delete: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            getRepository: jest.fn(),
          },
        },
        {
            provide: EncryptionService,
            useValue: {
                encrypt: jest.fn(),
            }
        }
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    entityManager = module.get(EntityManager);
    encryptionService = module.get(EncryptionService);

    (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
      return await cb(entityManager);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user within a transaction', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        fullName: 'Test User',
      };
      const newUser = new User();
      Object.assign(newUser, createUserDto);

      userRepository.create.mockReturnValue(newUser);
      (entityManager.save as jest.Mock).mockResolvedValue(newUser);

      const result = await service.create(createUserDto);

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(newUser);
    });
  });

  describe('findOneById', () => {
    it('should return a user if found', async () => {
      const userId = 'some-uuid';
      const user = new User();
      user.id = userId;

      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findOneById(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(user);
    });

    it('should throw an error if user is not found', async () => {
      const userId = 'some-uuid';

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById(userId)).rejects.toThrow(
        `User with ID ${userId} not found`
      );
    });
  });

  describe('updateProfile', () => {
    it('should update a user profile within a transaction', async () => {
      const userId = 'some-uuid';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Test User',
      };
      const existingUser = new User();
      const updatedUser = new User();
      Object.assign(updatedUser, existingUser, updateUserDto);

      userRepository.preload.mockResolvedValue(updatedUser);
      (entityManager.save as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, updateUserDto);

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(userRepository.preload).toHaveBeenCalledWith({
        id: userId,
        ...updateUserDto,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw an error if user to update is not found', async () => {
      const userId = 'some-uuid';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Test User',
      };

      userRepository.preload.mockResolvedValue(undefined);

      await expect(
        service.updateProfile(userId, updateUserDto)
      ).rejects.toThrow(`User with ID ${userId} not found`);
    });
  });

  describe('updateLastLogin', () => {
    it('should update the last login time for a user', async () => {
      const userId = 'some-uuid';

      await service.updateLastLogin(userId);

      expect(userRepository.update).toHaveBeenCalledWith(userId, {
        lastLoginAt: expect.any(Date),
      });
    });
  });

  describe('activate', () => {
    it('should set user status to ACTIVE', async () => {
      const userId = 'some-uuid';
      const user = new User();
      user.id = userId;
      user.status = UserStatus.INACTIVE; // Start with a different status

      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.activate(userId);

      expect(service.findOneById).toHaveBeenCalledWith(userId);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.ACTIVE })
      );
      expect(result.status).toEqual(UserStatus.ACTIVE);
    });
  });

  describe('deactivate', () => {
    it('should set user status to INACTIVE', async () => {
      const userId = 'some-uuid';
      const user = new User();
      user.id = userId;
      user.status = UserStatus.ACTIVE; // Start with a different status

      jest.spyOn(service, 'findOneById').mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.deactivate(userId);

      expect(service.findOneById).toHaveBeenCalledWith(userId);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.INACTIVE })
      );
      expect(result.status).toEqual(UserStatus.INACTIVE);
    });
  });

  describe('setCurrentRefreshToken', () => {
    const userId = 'user-id';
    const refreshToken = 'some-refresh-token';
    const hashedToken = 'hashed-token';
    const expiresAt = new Date();
    const user = { id: userId } as User;

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedToken);
      userRepository.findOne.mockResolvedValue(user);
    });

    it('should save a new refresh token', async () => {
      await service.setCurrentRefreshToken({ refreshToken, userId, expiresAt });

      expect(entityManager.create).toHaveBeenCalledWith(RefreshToken, {
        hashedToken,
        userId,
        expiresAt,
        ipAddress: undefined,
        userAgent: undefined,
      });
      expect(entityManager.save).toHaveBeenCalled();
    });

    it('should delete existing token with same IP and user agent', async () => {
      const ipAddress = '127.0.0.1';
      const userAgent = 'jest';

      await service.setCurrentRefreshToken({
        refreshToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      });

      expect(entityManager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId,
        ipAddress,
        userAgent,
      });
    });

    it('should remove an expired refresh token', async () => {
      const expiredRefreshToken = 'expired-token';
      const oldToken = { id: 'old-token-id' } as RefreshToken;
      (entityManager.findOne as jest.Mock).mockResolvedValue(oldToken);

      await service.setCurrentRefreshToken({
        refreshToken,
        userId,
        expiresAt,
        expiredRefreshToken,
      });

      expect(entityManager.findOne).toHaveBeenCalledWith(RefreshToken, {
        where: { userId, hashedToken: expiredRefreshToken },
      });
      expect(entityManager.remove).toHaveBeenCalledWith(oldToken);
    });

    it('should not remove any token if expiredRefreshToken is not found', async () => {
        const expiredRefreshToken = 'expired-token';
        (entityManager.findOne as jest.Mock).mockResolvedValue(null);
  
        await service.setCurrentRefreshToken({
          refreshToken,
          userId,
          expiresAt,
          expiredRefreshToken,
        });
  
        expect(entityManager.remove).not.toHaveBeenCalled();
      });

    it('should throw an error if user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.setCurrentRefreshToken({ refreshToken, userId, expiresAt })
      ).rejects.toThrow(`User with ID ${userId} not found`);
    });
  });

  describe('removeAllRefreshTokensForUser', () => {
    it('should delete all refresh tokens for a user', async () => {
      const userId = 'some-user-id';

      await service.removeAllRefreshTokensForUser(userId);

      expect(entityManager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId,
      });
    });
  });

  describe('invalidateAllTokens', () => {
    it('should update the tokensValidFrom field for a user', async () => {
      const userId = 'some-user-id';

      await service.invalidateAllTokens(userId);

      expect(entityManager.update).toHaveBeenCalledWith(User, userId, {
        tokensValidFrom: expect.any(Date),
      });
    });
  });

  describe('verifyRefreshToken', () => {
    const userId = 'user-id';
    const refreshToken = 'some-refresh-token';

    it('should return true for a valid token', async () => {
      const storedToken = {
        id: 'token-id',
        hashedToken: 'hashed-token',
        expiresAt: new Date(Date.now() + 100000),
      } as RefreshToken;
      refreshTokenRepository.find.mockResolvedValue([
        storedToken,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(result).toBe(true);
      expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
    });

    it('should return false for an invalid token', async () => {
      const storedToken = {
        id: 'token-id',
        hashedToken: 'hashed-token',
        expiresAt: new Date(Date.now() + 100000),
      } as RefreshToken;
      refreshTokenRepository.find.mockResolvedValue([
        storedToken,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(result).toBe(false);
    });

    it('should delete an expired token and return false', async () => {
      const storedToken = {
        id: 'token-id',
        hashedToken: 'hashed-token',
        expiresAt: new Date(Date.now() - 100000),
      } as RefreshToken;
      refreshTokenRepository.find.mockResolvedValue([
        storedToken,
      ]);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith(
        storedToken.id
      );
      expect(result).toBe(false);
    });

    it('should return false if no tokens are found', async () => {
      refreshTokenRepository.find.mockResolvedValue([]);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(result).toBe(false);
    });
  });

  describe('turnOnTwoFactorAuthentication', () => {
    it('should turn on 2FA for a user', async () => {
        const userId = 'user-id';
        const secret = 'secret';
        const encryptedSecret = 'encrypted-secret';
        const user = new User();
        const userRepo = {
            update: jest.fn(),
            findOneBy: jest.fn().mockResolvedValue(user)
        };
        const recoveryCodeRepo = {
            delete: jest.fn(),
            save: jest.fn(),
        };

        encryptionService.encrypt.mockReturnValue(encryptedSecret);
        (crypto.randomBytes as jest.Mock).mockImplementation(() => Buffer.from('code'));
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
        (entityManager.getRepository as jest.Mock).mockImplementation((repo) => {
            if (repo === User) {
                return userRepo;
            }
            if (repo === TwoFactorRecoveryCode) {
                return recoveryCodeRepo;
            }
        });

        const result = await service.turnOnTwoFactorAuthentication(userId, secret);

        expect(encryptionService.encrypt).toHaveBeenCalledWith(secret);
        expect(userRepo.update).toHaveBeenCalledWith(userId, { isTwoFactorAuthenticationEnabled: true, twoFactorAuthenticationSecret: encryptedSecret });
        expect(recoveryCodeRepo.delete).toHaveBeenCalledWith({ userId });
        expect(recoveryCodeRepo.save).toHaveBeenCalled();
        expect(result.user).toEqual(user);
        expect(result.recoveryCodes).toHaveLength(10);
    });
  });

  describe('turnOffTwoFactorAuthentication', () => {
    it('should turn off 2FA for a user', async () => {
        const userId = 'user-id';
        const user = new User();
        const userRepo = {
            update: jest.fn(),
            findOneBy: jest.fn().mockResolvedValue(user)
        };
        const recoveryCodeRepo = {
            delete: jest.fn(),
        };

        (entityManager.getRepository as jest.Mock).mockImplementation((repo) => {
            if (repo === User) {
                return userRepo;
            }
            if (repo === TwoFactorRecoveryCode) {
                return recoveryCodeRepo;
            }
        });

        const result = await service.turnOffTwoFactorAuthentication(userId);

        expect(userRepo.update).toHaveBeenCalledWith(userId, { isTwoFactorAuthenticationEnabled: false, twoFactorAuthenticationSecret: null });
        expect(recoveryCodeRepo.delete).toHaveBeenCalledWith({ userId });
        expect(result).toEqual(user);
    });
  });
});
