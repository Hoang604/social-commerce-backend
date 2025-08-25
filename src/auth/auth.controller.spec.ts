import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

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
            logoutAll: jest.fn(),
          },
        },
        {
            provide: ConfigService,
            useValue: {
                get: jest.fn(),
            }
        }
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
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

  describe('logoutAll', () => {
    it('should call authService.logoutAll and clear the refresh_token cookie', async () => {
      const req = {
        user: {
          id: 'test-id',
        },
      };
      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      (authService.logoutAll as jest.Mock).mockResolvedValue(true);

      const result = await controller.logoutAll(req, res);

      expect(authService.logoutAll).toHaveBeenCalledWith('test-id');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result).toEqual({
        message: 'Đã đăng xuất khỏi tất cả các thiết bị.',
      });
    });
  });

  describe('facebookLogin', () => {
    it('should return HttpStatus.OK', async () => {
        const result = await controller.facebookLogin();
        expect(result).toEqual(HttpStatus.OK);
    });
  });

  describe('facebookLoginCallback', () => {
    it('should redirect to the dashboard if 2FA is not enabled', async () => {
        const user = new User();
        const req = { user };
        const res = {
            cookie: jest.fn(),
            redirect: jest.fn(),
        } as unknown as Response;
        const tokens = { accessToken: 'access', refreshToken: 'refresh' };
        (authService.login as jest.Mock).mockResolvedValue(tokens);
        (configService.get as jest.Mock).mockReturnValue('http://dashboard');

        await controller.facebookLoginCallback(req, res);

        expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.any(Object));
        expect(res.redirect).toHaveBeenCalledWith('http://dashboard');
    });

    it('should redirect to the 2FA page if 2FA is enabled', async () => {
        const user = new User();
        const req = { user };
        const res = {
            cookie: jest.fn(),
            redirect: jest.fn(),
        } as unknown as Response;
        const tokens = { accessToken: 'partial-access' };
        (authService.login as jest.Mock).mockResolvedValue(tokens);
        (configService.get as jest.Mock).mockReturnValue('http://2fa');

        await controller.facebookLoginCallback(req, res);

        expect(res.cookie).toHaveBeenCalledWith('2fa_partial_token', 'partial-access', expect.any(Object));
        expect(res.redirect).toHaveBeenCalledWith('http://2fa');
    });
  });
});
