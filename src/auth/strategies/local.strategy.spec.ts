import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object if validation is successful', async () => {
      const user = new User();
      jest.spyOn(authService, 'validateUser').mockResolvedValue(user);

      const result = await strategy.validate('test@example.com', 'password');

      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      jest.spyOn(authService, 'validateUser').mockResolvedValue(null);

      await expect(strategy.validate('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });
  });
});
