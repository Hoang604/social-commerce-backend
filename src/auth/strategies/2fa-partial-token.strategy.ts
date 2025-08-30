import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwoFactorAuthenticationStrategy extends PassportStrategy(
  Strategy,
  '2fa-partial' // named this strategy as '2fa-partial'
) {
  private readonly logger = new Logger(TwoFactorAuthenticationStrategy.name);

  constructor(configService: ConfigService) {
    const twoFactorAuthenticationSecret = configService.get<string>(
      'TWO_FACTOR_AUTH_JWT_SECRET'
    );
    if (!twoFactorAuthenticationSecret) {
      throw new Error(
        'TWO_FACTOR_AUTH_JWT_SECRET is not defined in environment variables'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const data = request.cookies['2fa_partial_token'];
          this.logger.debug(
            `Extracting 2fa_partial_token: ${data ? 'Found' : 'Not found'}`
          );
          if (!data) {
            this.logger.warn('2fa_partial_token cookie not found');
            return null;
          }
          return data;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: twoFactorAuthenticationSecret,
      // pass request obj to the validate method
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any): any {
    this.logger.debug('2FA Strategy validate called');
    this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

    const partialToken = req.cookies['2fa_partial_token'];

    // Kiểm tra các điều kiện cần thiết
    if (!payload.sub) {
      this.logger.error('No user ID in payload');
      throw new UnauthorizedException('Xác thực thất bại');
    }

    if (!payload.is2FA) {
      this.logger.error('Not a 2FA token');
      throw new UnauthorizedException('Xác thực thất bại');
    }

    if (payload.isTwoFactorAuthenticated === true) {
      this.logger.error('2FA already completed');
      throw new UnauthorizedException('Xác thực thất bại');
    }

    this.logger.log(
      `2FA Strategy validation successful for user: ${payload.sub}`
    );

    // Gắn cả payload và refresh token vào request.user
    return { ...payload, partialToken };
  }
}
