import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard này sẽ tự động kích hoạt JwtStrategy.
 * Khi được áp dụng cho một route, nó sẽ kiểm tra sự tồn tại và tính hợp lệ của JWT
 * trong Authorization header của request.
 * Nếu token hợp lệ, nó sẽ gắn payload đã được xác thực vào request.user.
 * Nếu token không tồn tại hoặc không hợp lệ, nó sẽ tự động ném ra một UnauthorizedException (lỗi 401).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
