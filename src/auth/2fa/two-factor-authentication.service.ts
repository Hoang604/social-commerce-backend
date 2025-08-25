import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { toDataURL } from 'qrcode';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class TwoFactorAuthenticationService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService
  ) {}

  public async generateSecret(
    user: User
  ): Promise<{ secret: string; otpAuthUrl: string }> {
    const secret = authenticator.generateSecret();
    const appName = this.configService.get<string>(
      'TWO_FACTOR_APP_NAME',
      'SocialCommerce'
    );
    const otpAuthUrl = authenticator.keyuri(user.email, appName, secret);

    // We don't save the secret yet. It will be saved only after user confirms the code.
    return { secret, otpAuthUrl };
  }

  public async generateQrCodeDataURL(otpAuthUrl: string): Promise<string> {
    return toDataURL(otpAuthUrl);
  }

  public isCodeValid(code: string, secret: string): boolean {
    return authenticator.verify({
      token: code,
      secret: secret,
    });
  }
}
