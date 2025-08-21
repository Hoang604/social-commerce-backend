import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

// Định nghĩa cấu trúc của payload bên trong JWT để có type-safety
interface JwtPayload {
  sub: string; // ID của người dùng
  email: string;
  // iat: number; // Issued at - thời điểm token được tạo
  // exp: number; // Expiration time - thời điểm token hết hạn
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      // Chỉ định rằng token sẽ được lấy từ Header 'Authorization' dưới dạng 'Bearer token'.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Không bỏ qua việc kiểm tra token hết hạn. Nếu hết hạn, request sẽ bị từ chối.
      ignoreExpiration: false,

      // Lấy chuỗi bí mật từ biến môi trường để xác thực chữ ký của token.
      // Việc này đảm bảo token không bị giả mạo.
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Passport sẽ tự động gọi hàm này sau khi đã xác thực chữ ký và thời hạn của token thành công.
   * @param payload Payload đã được giải mã từ JWT.
   * @returns Một đối tượng sẽ được Passport gắn vào request.user.
   */
  async validate(payload: JwtPayload): Promise<{ id: string; email: string }> {
    // Tại bước này, chúng ta có thể tin tưởng rằng token là hợp lệ.
    // Payload chứa các thông tin mà chúng ta đã đưa vào khi tạo token trong AuthService.

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    // Trả về một đối tượng đơn giản chứa thông tin định danh người dùng.
    // Đối tượng này sẽ được truy cập thông qua `req.user` trong các controller được bảo vệ.
    return { id: payload.sub, email: payload.email };
  }
}
