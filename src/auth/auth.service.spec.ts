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
import { ForbiddenException } from '@nestjs/common';
import { User, UserStatus } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
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
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    entityManager = module.get<EntityManager>(EntityManager);

    (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn(),
          create: jest.fn(),
          save: jest.fn(),
        }),
      };
      return cb(mockManager);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return tokens and update last login', async () => {
      const user = new User();
      user.id = 'userId';
      user.email = 'test@example.com';
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      jest.spyOn(service as any, '_generateTokens').mockResolvedValue(tokens);
      (userService.setCurrentRefreshToken as jest.Mock).mockResolvedValue(undefined);
      (userService.updateLastLogin as jest.Mock).mockResolvedValue(undefined);

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
      (userService.findOneById as jest.Mock).mockResolvedValue(user);
      (userService.verifyRefreshToken as jest.Mock).mockResolvedValue(true);
      jest.spyOn(service as any, '_generateTokens').mockResolvedValue(tokens);
      (userService.setCurrentRefreshToken as jest.Mock).mockResolvedValue(undefined);

      const result = await service.refreshTokens('userId', 'refreshToken');

      expect(result).toEqual(tokens);
      expect(userService.setCurrentRefreshToken).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not found or inactive', async () => {
        (userService.findOneById as jest.Mock).mockResolvedValue(null);
        await expect(service.refreshTokens('userId', 'refreshToken')).rejects.toThrow(ForbiddenException);
      });
  
      it('should throw ForbiddenException for invalid refresh token', async () => {
        const user = new User();
        user.status = UserStatus.ACTIVE;
        (userService.findOneById as jest.Mock).mockResolvedValue(user);
        (userService.verifyRefreshToken as jest.Mock).mockResolvedValue(false);
        await expect(service.refreshTokens('userId', 'refreshToken')).rejects.toThrow(ForbiddenException);
      });
  });
});
