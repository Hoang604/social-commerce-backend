import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service'; // <-- Import UserService

interface JwtPayload {
  sub: string;
  email: string;
  iat: number; // Issued at timestamp (automatically added by jwtService.sign)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<{ id: string; email: string }> {
    if (!payload || !payload.sub || !payload.iat) {
      throw new UnauthorizedException('Invalid token payload.');
    }

    const user = await this.userService.findOneById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const tokensValidFromSec = Math.floor(
      user.tokensValidFrom.getTime() / 1000
    );
    if (payload.iat < tokensValidFromSec) {
      throw new UnauthorizedException('Token has been revoked.');
    }

    return { id: user.id, email: user.email };
  }
}