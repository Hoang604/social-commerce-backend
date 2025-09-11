import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') as string,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') as string,
      callbackURL: `${configService.get<string>('API_BASE_URL')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<any> {
    const { id, displayName, emails, photos } = profile;
    if (!emails || emails.length === 0) {
      return done(new Error('No email associated with this account!'), false);
    }

    if (!photos || photos.length === 0) {
      return done(
        new Error('No profile picture associated with this account!'),
        false
      );
    }

    const googleProfile = {
      provider: 'google',
      providerId: id,
      email: emails[0].value,
      name: displayName,
      avatarUrl: photos[0].value,
    };

    const user = await this.authService.validateOAuthUser(googleProfile);
    done(null, user);
  }
}
