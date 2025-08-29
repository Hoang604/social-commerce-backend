import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Response } from 'express';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/auth')
export class AuthController {
  private readonly refreshTokenExpiresIn: number;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    const refreshTokenExpiresInString = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN'
    ) as string;

    console.log('Original config value:', refreshTokenExpiresInString);
    console.log(
      'After slice(0, -1):',
      refreshTokenExpiresInString.slice(0, -1)
    );

    this.refreshTokenExpiresIn = parseInt(
      refreshTokenExpiresInString.slice(0, -1),
      10
    );

    console.log('Final parsed value:', this.refreshTokenExpiresIn);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: { ip: string; headers: { 'user-agent': string } },
    @Res({ passthrough: true }) response: Response
  ) {
    const newUser = await this.authService.register(registerDto);

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const loginResult = await this.authService.login(
      newUser,
      false,
      ipAddress,
      userAgent
    );

    if ('refreshToken' in loginResult && loginResult.refreshToken) {
      response.cookie('refresh_token', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        expires: new Date(
          Date.now() + this.refreshTokenExpiresIn * 24 * 60 * 60 * 1000
        ),
      });

      const { refreshToken, ...responsePayload } = loginResult;
      return responsePayload;
    }

    return loginResult;
  }

  /**
   * Log in a user and set refresh token in HTTP-only cookie.
   * The access token is returned in the response body.
   * @param req the request object containing user information
   * @param response the response object to set cookies
   * @returns Promise<{ accessToken: string }> the access token
   * add refresh_token into cookies
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Request()
    req: { user: User; ip: string; headers: { 'user-agent': string } },
    @Res({ passthrough: true }) response: Response
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const result = await this.authService.login(
      req.user,
      false,
      ipAddress,
      userAgent
    );

    if ('refreshToken' in result && result.refreshToken) {
      response.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        expires: new Date(
          Date.now() + this.refreshTokenExpiresIn * 24 * 60 * 60 * 1000
        ),
      });
      const { refreshToken, ...responsePayload } = result;
      return responsePayload;
    }
    return result;
  }

  /**
   * Refresh access tokens using a valid refresh token.
   *
   * @param req the request object containing user information
   * @param response the response object to set cookies
   * @returns Promise<{ accessToken: string }> new access token
   * add refresh_token into cookies
   */
  @UseGuards(RefreshTokenGuard)
  @Get('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req,
    @Res({ passthrough: true }) response: Response
  ) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;
    const tokens = await this.authService.refreshTokens(userId, refreshToken);

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(
        Date.now() + this.refreshTokenExpiresIn * 24 * 60 * 60 * 1000
      ),
    });

    return { accessToken: tokens.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(req.user.id, refreshToken);
    }
    response.clearCookie('refresh_token');
    return { message: 'Đăng xuất thành công.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Request() req,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.logoutAll(req.user.id);
    response.clearCookie('refresh_token');
    return { message: 'Đã đăng xuất khỏi tất cả các thiết bị.' };
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookLoginCallback(@Request() req, @Res() response: Response) {
    const user = req.user as User;
    if (!user) {
      throw new UnauthorizedException('Could not authenticate with Facebook.');
    }

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const tokens = await this.authService.login(
      user,
      false,
      ipAddress,
      userAgent
    );

    if ('refreshToken' in tokens) {
      // CASE 1: Full login successful (user does NOT have 2FA enabled)
      response.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        // highlight-start
        sameSite:
          this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',

        expires: new Date(
          Date.now() + this.refreshTokenExpiresIn * 24 * 60 * 60 * 1000
        ),
      });

      const frontendUrl = this.configService.get<string>(
        'FRONTEND_DASHBOARD_URL'
      );
      if (!frontendUrl) {
        throw new Error('FRONTEND_DASHBOARD_URL is not defined');
      }
      response.redirect(frontendUrl);
    } else {
      // CASE 2: Partial login (user has 2FA enabled)
      response.cookie('2fa_partial_token', tokens.accessToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        // highlight-start
        sameSite:
          this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
        // highlight-end
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      const twoFactorUrl = this.configService.get<string>('FRONTEND_2FA_URL');
      if (!twoFactorUrl) {
        throw new Error('FRONTEND_2FA_URL is not defined');
      }
      response.redirect(twoFactorUrl);
    }
  }
}
