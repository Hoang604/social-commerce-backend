import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from '../../user/user.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UserService,
          useValue: {
            findOneById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('testSecret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object if validation is successful', async () => {
      const user = new User();
      user.id = 'userId';
      user.email = 'test@example.com';
      user.tokensValidFrom = new Date(Date.now() - 10000);
      const payload = {
        sub: 'userId',
        email: 'test@example.com',
        iat: Date.now() / 1000,
      };
      jest.spyOn(userService, 'findOneById').mockResolvedValue(user);

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: user.id, email: user.email });
    });

    it('should throw UnauthorizedException for invalid payload', async () => {
      await expect(strategy.validate(null as any)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: 'userId',
        email: 'test@example.com',
        iat: Date.now() / 1000,
      };
      jest.spyOn(userService, 'findOneById').mockResolvedValue(null as any);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if token is revoked', async () => {
      const user = new User();
      user.id = 'userId';
      user.email = 'test@example.com';
      user.tokensValidFrom = new Date(Date.now() + 10000);
      const payload = {
        sub: 'userId',
        email: 'test@example.com',
        iat: Date.now() / 1000,
      };
      jest.spyOn(userService, 'findOneById').mockResolvedValue(user);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
