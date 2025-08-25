import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import ConfigModule
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccount } from './entities/social-account.entity';
import { TwoFactorRecoveryCode } from './entities/two-factor-recovery-code.entity';
import { TwoFactorAuthenticationController } from './2fa/two-factor-authentication.controller';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { TwoFactorAuthenticationService } from './2fa/two-factor-authentication.service';
import { EncryptionService } from 'src/common/services/encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshToken,
      SocialAccount,
      TwoFactorRecoveryCode,
    ]),
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
    FacebookStrategy,
    TwoFactorAuthenticationService,
    LocalStrategy,
    JwtStrategy,
    RefreshTokenStrategy,
    EncryptionService,
  ],
})
export class AuthModule {}
