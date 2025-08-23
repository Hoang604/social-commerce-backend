import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh' // named this strategy as 'jwt-refresh'
) {
  constructor(configService: ConfigService) {
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

  validate(req: Request, payload: any): any {
    const refreshToken = req.cookies['refresh_token'];
    // Gắn cả payload và refresh token vào request.user
    return { ...payload, refreshToken };
  }
}
