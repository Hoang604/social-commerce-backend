import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { User, UserStatus } from '../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { EntityManager, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import { UserIdentity } from './entities/user-identity.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly entityManager: EntityManager,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    return await this.entityManager.transaction(async (entityManager) => {
      const user = await this.userService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException('Người dùng không tồn tại.');
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash as string
      );
      if (!isPasswordValid) {
        throw new ForbiddenException({
          message: 'Mật khẩu hiện tại không đúng.',
          errorCode: 'WRONG_PASSWORD',
        });
      }

      const newHashedPassword = await bcrypt.hash(newPassword, 12);
      user.passwordHash = newHashedPassword;
      await entityManager.save(user);

      await this.logoutAll(userId);
    });
  }

  /**
   * Log in a user by generating access and refresh tokens.
   * The refresh token is stored in the database and the access token is returned to the client.
   * @param user the user entity
   * @param ipAddress the IP address of the user (optional)
   * @param userAgent the user agent string of the user's device (optional)
   * @returns Promise<{ accessToken: string, refreshToken: string, user: User }> the generated tokens and user info
   */
  async loginAndReturnTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    const tokens = await this._generateTokens(user.id, user.email);

    const liveTime =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
    const refreshTokenExpiresIn = parseInt(liveTime.slice(0, -1), 30);

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTokenExpiresIn);

    // Use UserService method to set refresh token
    await this.userService.setCurrentRefreshToken({
      refreshToken: tokens.refreshToken,
      userId: user.id,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.userService.updateLastLogin(user.id);
    const { passwordHash, ...userResult } = user;

    return { ...tokens, user: userResult };
  }

  async generate2FAPartialToken(userId: string) {
    const payload = {
      sub: userId,
      isTwoFactorAuthenticated: false,
      is2FA: true, // A flag to identify this as a 2FA-required token
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('TWO_FACTOR_AUTH_JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'TWO_FACTOR_AUTH_JWT_EXPIRES_IN'
      ),
    });
    return { accessToken };
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const userTokens = await this.entityManager.find(RefreshToken, {
      where: { userId },
    });

    console.log('User tokens:', userTokens);

    if (!userTokens || userTokens.length === 0) {
      return;
    }

    for (const token of userTokens) {
      console.log('Checking token:', token);
      const isMatch = await bcrypt.compare(rawRefreshToken, token.hashedToken);
      if (isMatch) {
        await this.entityManager.delete(RefreshToken, token.id);
        break;
      }
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.userService.removeAllRefreshTokensForUser(userId);
    await this.userService.invalidateAllTokens(userId);
  }

  /**
   * Refresh access tokens of user determined by userId, using a valid refresh token.
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
      // Generate Access Token
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      }),
      // Generate Refresh Token (also JWT)
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  /**
   * Validates a user from an OAuth provider.
   * 1. Finds an existing identity.
   * 2. If not found, tries to link to an existing user by email.
   * 3. If no user found, creates a new user and identity.
   */
  async validateOAuthUser(profile: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    avatarUrl: string;
  }): Promise<User> {
    // Wrap all logic in a transaction to ensure data integrity
    return this.entityManager.transaction(async (entityManager) => {
      const existingIdentity = await entityManager.findOne(UserIdentity, {
        where: { provider: profile.provider, providerId: profile.providerId },
        relations: ['user'],
      });

      // 1. User already exists with this provider
      if (existingIdentity) {
        return existingIdentity.user;
      }

      // 2. Link with an existing account with the same email
      let user = await entityManager.findOne(User, {
        where: { email: profile.email },
      });

      if (user) {
        // Update avatar if not already set
        if (!user.avatarUrl) {
          user.avatarUrl = profile.avatarUrl;
          await entityManager.save(user);
        }
      } else {
        // 3. Create a completely new user
        user = entityManager.create(User, {
          email: profile.email,
          fullName: profile.name,
          avatarUrl: profile.avatarUrl,
        });
        await entityManager.save(user);
      }

      // Create new identity for the user
      const newIdentity = entityManager.create(UserIdentity, {
        provider: profile.provider,
        providerId: profile.providerId,
        user: user, // Directly assign the User object
      });
      await entityManager.save(newIdentity);

      return user;
    });
  }

  async generateOneTimeCode(userId: string): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const key = `one-time-code:${code}`;
    const fiveMinutesInMs = 5 * 60 * 1000;

    // Store key-value in Redis with an expiration time (TTL) of 5 minutes
    await this.cacheManager.set(key, userId, fiveMinutesInMs);
    console.log('Storing one-time code in Redis with key:', key);

    const userid = await this.cacheManager.get<string>(key);
    console.log('Retrieved userId from Redis for key:', key, 'userId:', userid);
    return code;
  }

  // [B] Modify exchangeCodeForTokens function
  async exchangeCodeForTokens(
    code: string,
    ip: string,
    userAgent: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    const key = `one-time-code:${code}`;

    // 1. Get userId from Redis by key
    const userId = await this.cacheManager.get<string>(key);

    // 2. Validate the code
    if (!userId) {
      throw new UnauthorizedException(
        `No user found with key ${key}, invalid or expired code.`
      );
    }
    console.log('One-time code valid for userId:', userId);
    // 3. Invalidate the code immediately by deleting it from Redis
    await this.cacheManager.del(key);

    // 4. Get user information and create tokens (this logic remains the same)
    const user = await this.userService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return await this.loginAndReturnTokens(user, ip, userAgent);
  }
}