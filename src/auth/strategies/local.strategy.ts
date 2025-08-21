import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Cấu hình cho Passport-local.
    // Mặc định, nó sẽ tìm các trường 'username' và 'password' trong request body.
    // Ở đây, chúng ta chỉ định rõ rằng trường username của chúng ta là 'email'.
    super({ usernameField: 'email' });
  }

  /**
   * Passport sẽ tự động gọi hàm validate này khi LocalAuthGuard được kích hoạt.
   * @param email Giá trị từ trường 'email' trong request body.
   * @param password Giá trị từ trường 'password' trong request body.
   * @returns Đối tượng user nếu xác thực thành công.
   * @throws UnauthorizedException nếu xác thực thất bại.
   */
  async validate(email: string, password: string): Promise<User> {
    // Ủy quyền việc kiểm tra email và mật khẩu cho AuthService.
    const user = await this.authService.validateUser(email, password);

    // Nếu AuthService trả về null, nghĩa là thông tin không hợp lệ.
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // Nếu xác thực thành công, trả về toàn bộ đối tượng user.
    // Passport sẽ tự động gắn đối tượng này vào request.user.
    return user;
  }
}
