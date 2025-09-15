import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * This Guard will automatically activate JwtStrategy.
 * When applied to a route, it will check the existence and validity of the JWT
 * in the Authorization header of the request.
 * If the token is valid, it will attach the authenticated payload to request.user.
 * If the token does not exist or is invalid, it will automatically throw an UnauthorizedException (401 error).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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