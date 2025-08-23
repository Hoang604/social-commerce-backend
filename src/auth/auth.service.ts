import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { User } from '../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>
  ) {}

  async register(
    registerDto: RegisterDto
  ): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.userService.findOneByEmail(
      registerDto.email
    );
    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng.');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const newUser = await this.userService.create({
      email: registerDto.email,
      passwordHash,
    });

    const { passwordHash: _, ...result } = newUser;
    return result;
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      return user;
    }
    return null;
  }

  /**
   * Log in a user by generating access and refresh tokens.
   * The refresh token is stored in the database and the access token is returned to the client.
   * @param user the user entity
   * @param ipAddress the IP address of the user (optional)
   * @param userAgent the user agent string of the user's device (optional)
   * @returns Promise<{ accessToken: string, refreshToken: string }> the generated tokens
   */
  async login(user: User, ipAddress?: string, userAgent?: string) {
    const tokens = await this._generateTokens(user.id, user.email);

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Use UserService method to set refresh token
    await this.userService.setCurrentRefreshToken({
      refreshToken: tokens.refreshToken,
      userId: user.id,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.userService.updateLastLogin(user.id);
    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<boolean> {
    if (refreshToken) {
      const isValidToken = await this.userService.verifyRefreshToken(
        refreshToken,
        userId
      );
      if (isValidToken) {
        await this.refreshTokenRepository.delete({
          hashedToken: refreshToken,
          userId,
        });
      }
    } else {
      // If no refresh token provided, remove all refresh tokens for the user
      await this.refreshTokenRepository.delete({ userId });
    }
    return true;
  }

  /**
   * Refresh access tokens of user determined by userId, using a valid refresh token.\
   * remove old refresh token and add a new one to the database.
   *
   * @param userId the unique identifier of the user
   * @param refreshToken the refresh token to verify
   * @returns Promise<{ accessToken: string, refreshToken: string }> new access and refresh tokens
   */
  async refreshTokens(userId: string, refreshToken: string) {
    // Verify the refresh token using UserService
    const isValidToken = await this.userService.verifyRefreshToken(
      refreshToken,
      userId
    );
    if (!isValidToken) {
      throw new ForbiddenException('Access Denied');
    }

    // Get user details to generate new tokens
    const user = await this.userService.findOneById(userId);
    const tokens = await this._generateTokens(userId, user.email);

    // Calculate new expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Set the new refresh token (this will remove old ones and create a new one)
    await this.userService.setCurrentRefreshToken({
      refreshToken: tokens.refreshToken,
      userId,
      expiresAt,
      expiredRefreshToken: refreshToken,
    });

    return tokens;
  }

  private async _generateTokens(userId: string, email: string) {
    const accessTokenPayload = { sub: userId, email };
    const refreshToken = uuidv4();

    const [accessToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
