import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwoFactorRecoveryCode } from './entities/two-factor-recovery-code.entity';
import { TwoFactorAuthenticationController } from './2fa/two-factor-authentication.controller';
import { TwoFactorAuthenticationService } from './2fa/two-factor-authentication.service';
import { EncryptionService } from 'src/common/services/encryption.service';
import { TwoFactorAuthenticationStrategy } from './strategies/2fa-partial-token.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    CacheModule.register(),
    TypeOrmModule.forFeature([RefreshToken, TwoFactorRecoveryCode]),
    UserModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController, TwoFactorAuthenticationController],
  providers: [
    AuthService,
    TwoFactorAuthenticationService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    TwoFactorAuthenticationStrategy,
    RefreshTokenStrategy,
    EncryptionService,
    ConfigService,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
