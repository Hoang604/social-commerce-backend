import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with the provided dto', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        fullName: 'Test User',
      };
      const user = new User();
      user.id = 'test-id';
      user.email = 'test@example.com';
      user.fullName = 'Test User';

      (authService.register as jest.Mock).mockResolvedValue(user);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('should call authService.login and set a cookie with the refresh token', async () => {
      const user = new User();
      user.id = 'test-id';
      user.email = 'test@example.com';

      const req = {
        user,
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'jest',
        },
      };
      const res = {
        cookie: jest.fn(),
      } as unknown as Response;

      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };
      (authService.login as jest.Mock).mockResolvedValue(tokens);

      const result = await controller.login(req, res);

      expect(authService.login).toHaveBeenCalledWith(user, '127.0.0.1', 'jest');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'test-refresh-token',
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          expires: expect.any(Date),
        }
      );
      expect(result).toEqual({ accessToken: 'test-access-token' });
    });
  });

  describe('refreshTokens', () => {
    it('should call authService.refreshTokens and set a cookie with the new refresh token', async () => {
      const req = {
        user: {
          sub: 'test-id',
          refreshToken: 'old-refresh-token',
        },
      };
      const res = {
        cookie: jest.fn(),
      } as unknown as Response;

      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      (authService.refreshTokens as jest.Mock).mockResolvedValue(tokens);

      const result = await controller.refreshTokens(req, res);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'test-id',
        'old-refresh-token'
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          expires: expect.any(Date),
        }
      );
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });
  });

  describe('logout', () => {
    it('should call authService.logout and clear the refresh_token cookie', async () => {
      const req = {
        user: {
          id: 'test-id',
        },
        cookies: {
          refresh_token: 'test-refresh-token',
        },
      };
      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      (authService.logout as jest.Mock).mockResolvedValue(true);

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith(
        'test-id',
        'test-refresh-token'
      );
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result).toEqual({ message: 'Đăng xuất thành công.' });
    });

    it('should not call authService.logout if there is no refresh token', async () => {
      const req = {
        user: {
          id: 'test-id',
        },
        cookies: {},
      };
      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(req, res);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result).toEqual({ message: 'Đăng xuất thành công.' });
    });
  });
});
