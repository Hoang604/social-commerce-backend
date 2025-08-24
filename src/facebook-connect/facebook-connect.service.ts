import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { ConnectedPage } from './entities/connected-page.entity';
import { EncryptionService } from '../common/services/encryption.service';

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

@Injectable()
export class FacebookConnectService {
  private readonly logger = new Logger(FacebookConnectService.name);
  private stateStore = new Map<string, { userId: string; expires: number }>();

  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly encryptionService: EncryptionService,
    @InjectRepository(ConnectedPage)
    private readonly connectedPageRepository: Repository<ConnectedPage>
  ) {
    this.apiVersion =
      this.configService.get<string>('FACEBOOK_API_VERSION') || 'v18.0';
  }

  initiateConnection(userId: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(state, {
      userId,
      expires: Date.now() + 10 * 60 * 1000,
    });

    const appId = this.configService.get('FACEBOOK_APP_ID');
    const callbackUrl = this.configService.get('FACEBOOK_CALLBACK_URL');
    const scope = 'pages_show_list,pages_messaging,pages_read_engagement';

    const authUrl = `https://www.facebook.com/${this.apiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${callbackUrl}&state=${state}&scope=${scope}`;

    return authUrl;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    // ... (logic không thay đổi)
    const storedState = this.stateStore.get(state);

    if (!storedState || storedState.expires < Date.now()) {
      this.stateStore.delete(state);
      throw new ForbiddenException(
        'Invalid or expired state. CSRF attack detected.'
      );
    }

    const { userId } = storedState;
    this.stateStore.delete(state);

    try {
      const userAccessToken = await this.exchangeCodeForUserAccessToken(code);
      const longLivedUserToken =
        await this.getLongLivedUserAccessToken(userAccessToken);
      const pages = await this.getUserPages(longLivedUserToken);

      for (const page of pages) {
        await this.connectedPageRepository.save({
          userId,
          facebookPageId: page.id,
          pageName: page.name,
          encryptedPageAccessToken: this.encryptionService.encrypt(
            page.access_token
          ),
        });
      }
    } catch (error) {
      this.logger.error('Failed to handle Facebook callback', error.stack);
      throw new InternalServerErrorException(
        'Failed to connect with Facebook.'
      );
    }
  }

  private async exchangeCodeForUserAccessToken(code: string): Promise<string> {
    // --- THAY ĐỔI 4: Sử dụng biến apiVersion trong URL ---
    const url = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
    const params = {
      client_id: this.configService.get('FACEBOOK_APP_ID'),
      client_secret: this.configService.get('FACEBOOK_APP_SECRET'),
      redirect_uri: this.configService.get('FACEBOOK_CALLBACK_URL'),
      code,
    };

    const response = await firstValueFrom(
      this.httpService.get(url, { params })
    );
    return response.data.access_token;
  }

  private async getLongLivedUserAccessToken(
    shortLivedToken: string
  ): Promise<string> {
    // --- THAY ĐỔI 5 (khuyến nghị): Sử dụng biến apiVersion trong URL ---
    /*
    const url = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
    const params = {
      grant_type: 'fb_exchange_token',
      client_id: this.configService.get('FACEBOOK_APP_ID'),
      client_secret: this.configService.get('FACEBOOK_APP_SECRET'),
      fb_exchange_token: shortLivedToken,
    };
    const response = await firstValueFrom(this.httpService.get(url, { params }));
    return response.data.access_token;
    */
    return shortLivedToken;
  }

  private async getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
    // --- THAY ĐỔI 6 (khuyến nghị): Sử dụng biến apiVersion trong URL ---
    const url = `https://graph.facebook.com/${this.apiVersion}/me/accounts`;
    const params = {
      access_token: userAccessToken,
      fields: 'id,name,access_token',
    };
    const response = await firstValueFrom(
      this.httpService.get(url, { params })
    );
    return response.data.data;
  }

  async listConnectedPages(userId: string): Promise<ConnectedPage[]> {
    return this.connectedPageRepository.find({ where: { userId } });
  }

  async disconnectPage(userId: string, pageId: string): Promise<void> {
    await this.connectedPageRepository.delete({ id: pageId, userId });
  }
}
