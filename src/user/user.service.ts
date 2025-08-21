import { Injectable } from '@nestjs/common';
import { User, UserStatus } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly entityManager: EntityManager
  ) {}

  /**
   * Create a new user and save it to the database.
   *
   * @param createUserDto user data to create a new user, including email and password_hash
   * @returns Promise<User> newly created user entity
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.entityManager.transaction(async (entityManager) => {
      const newUser = this.userRepository.create(createUserDto);
      return await entityManager.save(newUser);
    });
  }

  /**
   * Find a user by their ID.
   *
   * @param id the unique identifier of the user
   * @returns Promise<User> the user entity if found, otherwise throws an error
   */
  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Find a user by their email.
   *
   * @param email the email address of the user
   * @returns Promise<User> the user entity if found, otherwise throws an error
   */
  async findOneByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }
    return user;
  }

  /**
   * Update a user's profile with the provided data.
   *
   * @param id the unique identifier of the user
   * @param updateUserDto data to update the user's profile, including fullName, avatarUrl, and timezone
   * @returns Promise<User> the updated user entity
   */
  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return this.entityManager.transaction(async (entityManager) => {
      const user = await this.userRepository.preload({
        id,
        ...updateUserDto,
      });
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }
      return entityManager.save(user);
    });
  }

  /**     * Update the last login timestamp for a user.
   *
   * @param id the unique identifier of the user
   * @returns Promise<void> resolves when the update is complete
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  /**
   * Activate a user by setting their status to ACTIVE.
   *
   * @param id the unique identifier of the user
   * @returns Promise<User> the updated user entity with status set to ACTIVE
   */
  async activate(id: string): Promise<User> {
    const user = await this.findOneById(id);
    user.status = UserStatus.ACTIVE;
    return this.userRepository.save(user);
  }

  /**
   * Deactivate a user by setting their status to INACTIVE.
   *
   * @param id the unique identifier of the user
   * @returns Promise<User> the updated user entity with status set to INACTIVE
   */
  async deactivate(id: string): Promise<User> {
    const user = await this.findOneById(id);
    user.status = UserStatus.INACTIVE;
    return this.userRepository.save(user);
  }

  /**
   * Set the current refresh token for a user (hashed).
   *
   * @param refreshToken the refresh token to hash and store
   * @param userId the unique identifier of the user
   * @param expiresAt when the refresh token expires
   * @param ipAddress optional IP address where the token was issued
   * @param userAgent optional user agent string
   * @returns Promise<void> resolves when the update is complete
   */
  async setCurrentRefreshToken(
    refreshToken: string,
    userId: string,
    expiresAt: Date,
    expiredRefreshToken?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return this.entityManager.transaction(async (entityManager) => {
      const hashedToken = await bcrypt.hash(refreshToken, 12);

      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // If an expired refresh token is provided, remove it
      if (expiredRefreshToken) {
        await entityManager.delete(RefreshToken, {
          userId,
          hashedToken: expiredRefreshToken,
        });
      }

      // Create a new refresh token
      const newRefreshToken = entityManager.create(RefreshToken, {
        hashedToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      });

      await entityManager.save(newRefreshToken);
    });
  }

  /**
   * Remove the refresh token for a user.
   *
   * @param userId the unique identifier of the user
   * @returns Promise<void> resolves when the update is complete
   */
  async removeRefreshToken(userId: string): Promise<void> {
    this.entityManager.transaction(async (entityManager) => {
      await entityManager.delete(RefreshToken, { userId });
    });
  }

  /**
   * Verify if a refresh token is valid for a user.
   *
   * @param refreshToken the refresh token to verify
   * @param userId the unique identifier of the user
   * @returns Promise<boolean> true if the token is valid, false otherwise
   */
  async verifyRefreshToken(
    refreshToken: string,
    userId: string
  ): Promise<boolean> {
    const storedTokens = await this.refreshTokenRepository.find({
      where: { userId },
    });

    for (const storedToken of storedTokens) {
      // Check if token hasn't expired
      if (storedToken.expiresAt < new Date()) {
        // Remove expired token
        await this.refreshTokenRepository.delete(storedToken.id);
        continue;
      }

      // Check if the provided token matches the stored hashed token
      const isMatch = await bcrypt.compare(
        refreshToken,
        storedToken.hashedToken
      );
      if (isMatch) {
        return true;
      }
    }

    return false;
  }
}
