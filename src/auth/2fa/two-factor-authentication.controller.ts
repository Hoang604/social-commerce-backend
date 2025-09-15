import {
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { TwoFactorAuthenticationService } from './two-factor-authentication.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { UserService } from '../../user/user.service';
import { TurnOn2faDto } from './dto/turn-on-2fa.dto';
import { AuthService } from '../auth.service';
import { EncryptionService } from '../../common/services/encryption.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { TwoFactorRequest } from '../../common/types/two-factor-request.interface';

@Controller('2fa')
export class TwoFactorAuthenticationController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorAuthenticationService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService
  ) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  async generate(@Req() req: AuthenticatedRequest, @Res() res) {
    const { user } = req;
    const { secret, otpAuthUrl } =
      await this.twoFactorAuthService.generateSecret(user as any);

    // Store the temporary secret in an HttpOnly cookie to be verified later
    res.cookie('2fa_secret', this.encryptionService.encrypt(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite:
        this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes validity
    });

    const qrCodeDataURL =
      await this.twoFactorAuthService.generateQrCodeDataURL(otpAuthUrl);
    return res.json({ qrCodeDataURL });
  }

  @Post('turn-on')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async turnOn(@Req() req: AuthenticatedRequest, @Body() body: TurnOn2faDto) {
    const temporarySecretEncrypted = req.cookies['2fa_secret'];
    if (!temporarySecretEncrypted) {
      throw new BadRequestException(
        '2FA secret cookie not found. Please start over.'
      );
    }
    const temporarySecret = this.encryptionService.decrypt(
      temporarySecretEncrypted
    );

    const isCodeValid = this.twoFactorAuthService.isCodeValid(
      body.code,
      temporarySecret
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }

    const { user, recoveryCodes } =
      await this.userService.turnOnTwoFactorAuthentication(
        req.user.id,
        temporarySecret
      );

    return {
      message: 'Two-factor authentication has been enabled successfully.',
      recoveryCodes,
    };
  }

  @Post('authenticate')
  @UseGuards(AuthGuard('2fa-partial'))
  @HttpCode(HttpStatus.OK)
  async authenticate(
    @Req() req: TwoFactorRequest,
    @Body() body: TurnOn2faDto,
    @Res() res
  ) {
    console.log('Request user:', req.user);
    console.log('Using user ID:', req.user.sub);

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const user = await this.userService.findOneById(req.user.sub);

    if (!user) {
      console.error('User not found for ID:', req.user.sub);
      throw new UnauthorizedException('User not found');
    }

    console.log('Found user:', user);

    if (!user.isTwoFactorAuthenticationEnabled) {
      throw new ForbiddenException('2FA is not enabled for this account.');
    }

    const decryptedSecret = this.encryptionService.decrypt(
      user.twoFactorAuthenticationSecret as string
    );
    const isCodeValid = this.twoFactorAuthService.isCodeValid(
      body.code,
      decryptedSecret
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }

    const data = await this.authService.loginAndReturnTokens(
      user,
      ipAddress,
      userAgent
    );
    const { accessToken, refreshToken, user: userResult } = data;

    const refreshTokenExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN'
    ) as string;
    const refreshTokenExpiryDays = parseInt(
      refreshTokenExpiresIn.slice(0, -1),
      10
    );
    // Set the refresh token in an HttpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      expires: new Date(
        Date.now() + refreshTokenExpiryDays * 24 * 60 * 60 * 1000
      ),
    });

    // Clear the temporary cookies
    res.clearCookie('2fa_partial_token');
    res.clearCookie('2fa_secret');

    console.log('User fully authenticated with 2FA:', userResult.email);

    // Return full tokens, setting the refresh token in the cookie
    res.json({ accessToken, user: userResult });
  }

  @Post('turn-off')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async turnOff(
    @Req() req: AuthenticatedRequest,
    @Body() body: TurnOn2faDto // Reuse the DTO that has the 'code' field
  ) {
    const user = await this.userService.findOneById(req.user.id);

    if (!user.isTwoFactorAuthenticationEnabled) {
      throw new ForbiddenException('2FA is not enabled for this account.');
    }

    const decryptedSecret = this.encryptionService.decrypt(
      user.twoFactorAuthenticationSecret as string
    );

    const isCodeValid = this.twoFactorAuthService.isCodeValid(
      body.code,
      decryptedSecret
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }

    await this.userService.turnOffTwoFactorAuthentication(req.user.id);

    return { message: 'Two-factor authentication has been disabled.' };
  }
}
