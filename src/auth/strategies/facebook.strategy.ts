import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService
  ) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackURL = configService.get<string>(
      'FACEBOOK_LOGIN_CALLBACK_URL'
    );

    if (!clientID || !clientSecret || !callbackURL) {
      throw new InternalServerErrorException(
        'Facebook OAuth credentials are not configured.'
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'name', 'emails', 'picture'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void
  ): Promise<any> {
    const { name, emails, photos, id } = profile;

    // Safely construct the full name
    const fullName = [name?.givenName, name?.familyName]
      .filter(Boolean)
      .join(' ');

    const userProfile = {
      provider: 'facebook',
      providerId: id,
      email: emails?.[0].value,
      fullName: fullName,
      avatarUrl: photos?.[0].value,
    };

    const user = await this.authService.validateSocialLogin(userProfile);
    done(null, user);
  }
}
