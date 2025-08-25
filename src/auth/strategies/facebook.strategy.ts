import { Injectable } from '@nestjs/common';
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
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID'),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET'),
      callbackURL: configService.get<string>('FACEBOOK_LOGIN_CALLBACK_URL'),
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'name', 'emails', 'picture'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const userProfile = {
      provider: 'facebook',
      providerId: id,
      email: emails?.[0].value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      fullName: `${name.givenName} ${name.familyName}`,
      avatarUrl: photos?.[0].value,
    };

    const user = await this.authService.validateSocialLogin(userProfile);
    done(null, user);
  }
}
