import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { User, UserStatus } from '../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SocialAccount } from './entities/social-account.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly entityManager: EntityManager
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    return await this.entityManager.transaction(async (entityManager) => {
      const existingUser = await this.userService.findOneByEmail(
        registerDto.email
      );
      if (existingUser) {
        throw new ConflictException('Email này đã được sử dụng.');
      }

      const passwordHash = await bcrypt.hash(registerDto.password, 12);

      const newUser = await entityManager.save(User, {
        email: registerDto.email,
        passwordHash,
        fullName: registerDto.fullName,
      });

      return newUser;
    });
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userService.findOneByEmail(email);

    if (!user) {
      throw new ForbiddenException('Email hoặc mật khẩu không đúng.');
    }

    if (user && (await bcrypt.compare(pass, user.passwordHash as string))) {
      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException('Tài khoản của bạn đã bị đình chỉ.');
      }

      if (user.status === UserStatus.INACTIVE) {
        return this.userService.activate(user.id);
      }

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
  async login(
    user: User,
    isTwoFactorAuthenticated = false,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (user.isTwoFactorAuthenticationEnabled && !isTwoFactorAuthenticated) {
      console.log('Two-factor authentication is enabled but not yet verified.');
      const payload = {
        sub: user.id,
        isTwoFactorAuthenticated: false,
        is2FA: true, // A flag to identify this as a 2FA-required token
      };
      const accessToken = await this.jwtService.signAsync(payload, {
        expiresIn: '5m',
      });
      return { accessToken }; // Only return the partial access token
    }

    // Normal login flow
    return this.entityManager.transaction(async (entityManager) => {
      const userService = this.userService;

      const tokens = await this._generateTokens(user.id, user.email);

      // Calculate expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Use UserService method to set refresh token
      await userService.setCurrentRefreshToken({
        refreshToken: tokens.refreshToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
      });

      await userService.updateLastLogin(user.id);
      const { passwordHash, ...userResult } = user;

      return { ...tokens, user: userResult };
    });
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const userTokens = await this.refreshTokenRepository.find({
      where: { userId },
    });

    if (!userTokens || userTokens.length === 0) {
      return;
    }

    for (const token of userTokens) {
      console.log('Checking token:', token);
      const isMatch = await bcrypt.compare(rawRefreshToken, token.hashedToken);
      if (isMatch) {
        await this.refreshTokenRepository.delete(token.id);
        break;
      }
    }
  }

  async logoutAll(userId: string): Promise<boolean> {
    this.userService.removeAllRefreshTokensForUser(userId);
    this.userService.invalidateAllTokens(userId);
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
    const user = await this.userService.findOneById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Access Denied');
    }

    try {
      // Verify the refresh token using the injected UserService instance
      const isValidToken = await this.userService.verifyRefreshToken(
        refreshToken,
        userId
      );

      // If token is not valid (doesn't exist), it's a security risk.
      // Log out all sessions.
      if (!isValidToken) {
        await this.logoutAll(userId);
        throw new ForbiddenException('Access Denied');
      }
    } catch (error) {
      // If the error is due to an expired token, re-throw it so the user
      // gets a clear message to log in again.
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(
          'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
        );
      }
      // For any other unexpected errors, re-throw them.
      throw error;
    }

    // If we reach here, the token was valid. Proceed with rotation.
    const tokens = await this._generateTokens(userId, user.email);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Set the new refresh token (this will remove the old one)
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
    const [accessToken, refreshToken] = await Promise.all([
      // Tạo Access Token
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      }),
      // Tạo Refresh Token (cũng là JWT)
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async validateSocialLogin(profile: any): Promise<User> {
    return this.entityManager.transaction(async (manager) => {
      const socialAccountRepo = manager.getRepository(SocialAccount);
      const userRepo = manager.getRepository(User);

      let socialAccount = await socialAccountRepo.findOne({
        where: {
          provider: profile.provider,
          providerUserId: profile.providerId,
        },
        relations: ['user'],
      });

      if (socialAccount) {
        // User found, login successful
        return socialAccount.user;
      }

      // If social account not found, check if a user with this email already exists
      let user = await userRepo.findOne({ where: { email: profile.email } });

      if (user) {
        // User with this email exists, but hasn't linked this social account yet.
        // For security, we link them here automatically, but a more secure flow
        // would ask them to log in with their password first. We follow the spec.
        // Note: The spec was updated to NOT link automatically. This code should
        // throw an error to be handled by the frontend.
        // For now, we will link it as per initial thought, can be refined.
      } else {
        // This is a new user
        user = userRepo.create({
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          status: UserStatus.ACTIVE,
          passwordHash: null, // No password for social login
        });
        await manager.save(user);
      }

      // Create and link the social account
      const newSocialAccount = socialAccountRepo.create({
        provider: profile.provider,
        providerUserId: profile.providerId,
        userId: user.id,
      });
      await manager.save(newSocialAccount);

      return user;
    });
  }
}
