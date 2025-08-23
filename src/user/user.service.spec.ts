import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserStatus } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let entityManager: EntityManager;

  const USER_REPOSITORY_TOKEN = getRepositoryToken(User);
  const REFRESH_TOKEN_REPOSITORY_TOKEN = getRepositoryToken(RefreshToken);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY_TOKEN,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            preload: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: REFRESH_TOKEN_REPOSITORY_TOKEN,
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
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(USER_REPOSITORY_TOKEN);
    refreshTokenRepository = module.get<Repository<RefreshToken>>(
      REFRESH_TOKEN_REPOSITORY_TOKEN
    );
    entityManager = module.get<EntityManager>(EntityManager);

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

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          const transactionalEntityManager = {
            save: jest.fn().mockResolvedValue(newUser),
          };
          return await cb(transactionalEntityManager);
        }
      );

      jest.spyOn(userRepository, 'create').mockReturnValue(newUser);

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

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.findOneById(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(user);
    });

    it('should throw an error if user is not found', async () => {
      const userId = 'some-uuid';

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

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

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          const transactionalEntityManager = {
            save: jest.fn().mockResolvedValue(updatedUser),
          };
          return await cb(transactionalEntityManager);
        }
      );

      jest.spyOn(userRepository, 'preload').mockResolvedValue(updatedUser);

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

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          const transactionalEntityManager = {
            save: jest.fn(),
          };
          return await cb(transactionalEntityManager);
        }
      );

      jest.spyOn(userRepository, 'preload').mockResolvedValue(undefined);

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
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

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
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

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
      (userRepository.findOne as jest.Mock).mockResolvedValue(user);
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

    it('should throw an error if user is not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

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
      (refreshTokenRepository.find as jest.Mock).mockResolvedValue([
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
      (refreshTokenRepository.find as jest.Mock).mockResolvedValue([
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
      (refreshTokenRepository.find as jest.Mock).mockResolvedValue([
        storedToken,
      ]);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith(
        storedToken.id
      );
      expect(result).toBe(false);
    });

    it('should return false if no tokens are found', async () => {
      (refreshTokenRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await service.verifyRefreshToken(refreshToken, userId);

      expect(result).toBe(false);
    });
  });
});
