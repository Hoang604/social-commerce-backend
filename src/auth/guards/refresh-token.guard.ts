import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  handleRequest(err, user, info) {
    // If there's an error or user does not exist, throw UnauthorizedException
    if (err || !user) {
      throw new UnauthorizedException({
        message: info?.message || 'Unauthorized',
        error: 'Unauthorized',
        statusCode: 401,
        errorCode: 'TOKEN_INVALID',
      });
    }
    return user;
  }
}