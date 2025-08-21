import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard này sẽ tự động kích hoạt LocalStrategy.
 * Khi được áp dụng cho một route, nó sẽ chạy logic xác thực của passport-local.
 * Nếu xác thực thành công, nó sẽ gắn đối tượng user vào request (req.user).
 * Nếu thất bại, nó sẽ tự động ném ra một UnauthorizedException (lỗi 401).
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
