import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh' // named this strategy as 'jwt-refresh'
) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService
  ) {
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET is not defined in environment variables'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const data = request.cookies['refresh_token'];
          if (!data) {
            return null;
          }
          return data;
        },
      ]),
      secretOrKey: refreshSecret,
      // pass request obj to the validate method
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<any> {
    const userId = payload.sub;
    if (!userId) {
      throw new Error('Invalid token payload: missing user ID (sub)');
    }
    const user = await this.userService.findOneById(userId);
    const tokensValidFromSec = Math.floor(
      user.tokensValidFrom.getTime() / 1000
    );
    if (payload.iat < tokensValidFromSec) {
      throw new UnauthorizedException('Token has been revoked.');
    }
    const refreshToken = req.cookies['refresh_token'];
    // Gắn cả payload và refresh token vào request.user
    return { ...payload, refreshToken };
  }
}
