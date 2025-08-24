import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

describe('RefreshTokenStrategy', () => {
  let strategy: RefreshTokenStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('testSecret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<RefreshTokenStrategy>(RefreshTokenStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return payload with refresh token', () => {
      const req = { cookies: { refresh_token: 'testRefreshToken' } } as unknown as Request;
      const payload = { sub: 'userId', email: 'test@example.com' };

      const result = strategy.validate(req, payload);

      expect(result).toEqual({ ...payload, refreshToken: 'testRefreshToken' });
    });
  });
});
