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

// Interface để định nghĩa cấu trúc dữ liệu trả về từ Facebook API
interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

@Injectable()
export class FacebookConnectService {
  private readonly logger = new Logger(FacebookConnectService.name);
  // Sử dụng Map để lưu trữ state tạm thời, trong production nên dùng Redis
  private stateStore = new Map<string, { userId: string; expires: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly encryptionService: EncryptionService,
    @InjectRepository(ConnectedPage)
    private readonly connectedPageRepository: Repository<ConnectedPage>
  ) {}

  /**
   * Khởi tạo luồng kết nối OAuth2
   * @param userId - ID của người dùng đang thực hiện kết nối
   * @returns URL ủy quyền của Facebook
   */
  initiateConnection(userId: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    // Lưu state và userId, đặt thời gian hết hạn là 10 phút
    this.stateStore.set(state, {
      userId,
      expires: Date.now() + 10 * 60 * 1000,
    });

    const appId = this.configService.get('FACEBOOK_APP_ID');
    const callbackUrl = this.configService.get('FACEBOOK_CALLBACK_URL');
    const scope = 'pages_show_list,pages_messaging,pages_read_engagement';

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${callbackUrl}&state=${state}&scope=${scope}`;

    return authUrl;
  }

  /**
   * Xử lý callback từ Facebook sau khi người dùng ủy quyền
   * @param code - Mã ủy quyền từ Facebook
   * @param state - Giá trị state để chống tấn công CSRF
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const storedState = this.stateStore.get(state);

    if (!storedState || storedState.expires < Date.now()) {
      this.stateStore.delete(state);
      throw new ForbiddenException(
        'Invalid or expired state. CSRF attack detected.'
      );
    }

    const { userId } = storedState;
    this.stateStore.delete(state); // Xóa state sau khi đã sử dụng

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
    const url = 'https://graph.facebook.com/v18.0/oauth/access_token';
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
    // Trong thực tế, bạn nên lấy token dài hạn, nhưng để đơn giản cho MVP, chúng ta có thể bỏ qua bước này
    // Tuy nhiên, đây là cách thực hiện:
    /*
    const url = 'https://graph.facebook.com/v18.0/oauth/access_token';
    const params = {
      grant_type: 'fb_exchange_token',
      client_id: this.configService.get('FACEBOOK_APP_ID'),
      client_secret: this.configService.get('FACEBOOK_APP_SECRET'),
      fb_exchange_token: shortLivedToken,
    };
    const response = await firstValueFrom(this.httpService.get(url, { params }));
    return response.data.access_token;
    */
    return shortLivedToken; // For simplicity in MVP
  }

  private async getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
    const url = `https://graph.facebook.com/me/accounts`;
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
