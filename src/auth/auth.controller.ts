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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Response } from 'express';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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
    req: { user: User; ip: string; headers: { 'user-agent': string } }, // <-- Định nghĩa rõ hơn kiểu của req
    @Res({ passthrough: true }) response: Response
  ) {
    // --- LẤY THÔNG TIN TỪ REQUEST ---
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    // --- TRUYỀN XUỐNG SERVICE ---
    const tokens = await this.authService.login(req.user, ipAddress, userAgent);

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken: tokens.accessToken };
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
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
}
