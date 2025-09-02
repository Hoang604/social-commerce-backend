import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  handleRequest(err, user, info) {
    // Nếu có lỗi hoặc user không tồn tại, ném ra UnauthorizedException
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
