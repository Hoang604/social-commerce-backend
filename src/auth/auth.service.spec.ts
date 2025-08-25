jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../user/user.service');

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { EntityManager } from 'typeorm';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { User, UserStatus } from '../user/entities/user.entity';
import { EncryptionService } from '../common/services/encryption.service';
import * as bcrypt from 'bcrypt';

jest.mock('../common/services/encryption.service');

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findOneByEmail: jest.fn(),
            create: jest.fn(),
            setCurrentRefreshToken: jest.fn(),
            updateLastLogin: jest.fn(),
            findOneById: jest.fn(),
            verifyRefreshToken: jest.fn(),
            removeAllRefreshTokensForUser: jest.fn(),
            invalidateAllTokens: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(entityManager)),
            getRepository: jest
              .fn()
              .mockReturnValue({
                findOne: jest.fn(),
                create: jest.fn(),
                save: jest.fn(),
              }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    entityManager = module.get(EntityManager);
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
      const newUser = {
        id: 'userId',
        ...registerDto,
        passwordHash: hashedPassword,
      };

      userService.findOneByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      userService.create.mockResolvedValue(newUser as any);

      const result = await service.register(registerDto);

      expect(result).toEqual(newUser);
    });

    it('should throw a ConflictException if the email is already in use', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        fullName: 'Test User',
      };
      const existingUser = { id: 'userId', ...registerDto };

      userService.findOneByEmail.mockResolvedValue(existingUser as any);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('login', () => {
    it('should return tokens and update last login', async () => {
      const user = new User();
      user.id = 'userId';
      user.email = 'test@example.com';
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      jest.spyOn(service as any, '_generateTokens').mockResolvedValue(tokens);

      const result = await service.login(user, 'ip', 'ua');

      expect(result).toEqual(tokens);
      expect(userService.setCurrentRefreshToken).toHaveBeenCalled();
      expect(userService.updateLastLogin).toHaveBeenCalledWith(user.id);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      const user = new User();
      user.id = 'userId';
      user.email = 'test@example.com';
      user.status = UserStatus.ACTIVE;
      const tokens = { accessToken: 'newAccess', refreshToken: 'newRefresh' };
      userService.findOneById.mockResolvedValue(user);
      userService.verifyRefreshToken.mockResolvedValue(true);
      jest.spyOn(service as any, '_generateTokens').mockResolvedValue(tokens);

      const result = await service.refreshTokens('userId', 'refreshToken');

      expect(result).toEqual(tokens);
      expect(userService.setCurrentRefreshToken).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not found or inactive', async () => {
      userService.findOneById.mockResolvedValue(null as any);
      await expect(
        service.refreshTokens('userId', 'refreshToken')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for invalid refresh token', async () => {
      const user = new User();
      user.status = UserStatus.ACTIVE;
      userService.findOneById.mockResolvedValue(user);
      userService.verifyRefreshToken.mockResolvedValue(false);
      await expect(
        service.refreshTokens('userId', 'refreshToken')
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
