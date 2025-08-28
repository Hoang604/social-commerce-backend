import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, EntityManager } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { ConnectedPage } from './entities/connected-page.entity';
import { EncryptionService } from '../common/services/encryption.service';
import { AxiosError } from 'axios';
import { PendingPagesDto } from './dto/pending-pages.dto';
import { ConnectPagesDto } from './dto/connect-pages.dto';

interface FacebookPage {
  id: string;
  name: string;
}

interface FacebookPageWithToken extends FacebookPage {
  access_token: string;
}

interface PendingConnection {
  userAccessToken: string;
  pages: FacebookPage[];
  expires: number;
}

// Định nghĩa cấu trúc cho kết quả trả về của service
export interface ConnectPagesResult {
  succeeded: Partial<ConnectedPage>[];
  failed: { facebookPageId: string; pageName: string; error: string }[];
}

@Injectable()
export class FacebookConnectService {
  private readonly logger = new Logger(FacebookConnectService.name);
  private stateStore = new Map<string, { userId: string; expires: number }>();
  private pendingConnections = new Map<string, PendingConnection>();

  private readonly apiVersion: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly callbackUrl: string;
  private readonly frontendSelectPageUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly encryptionService: EncryptionService,
    @InjectRepository(ConnectedPage)
    private readonly pageRepository: Repository<ConnectedPage>,
    private readonly entityManager: EntityManager // Inject EntityManager
  ) {
    this.apiVersion = this.configService.get<string>(
      'FACEBOOK_API_VERSION',
      'v23.0'
    );
    this.appId = this.configService.get<string>('FACEBOOK_APP_ID') || '';
    this.appSecret =
      this.configService.get<string>('FACEBOOK_APP_SECRET') || '';
    this.callbackUrl =
      this.configService.get<string>('FACEBOOK_CALLBACK_URL') || '';
    this.frontendSelectPageUrl = this.configService.get<string>(
      'FRONTEND_SELECT_PAGE_URL',
      'https://app.dinhviethoang604.id.vn/settings/connections/select-page'
    );
  }

  initiateConnection(userId: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(state, {
      userId,
      expires: Date.now() + 10 * 60 * 1000,
    });

    const scope =
      'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata';
    const authUrl = `https://www.facebook.com/${this.apiVersion}/dialog/oauth?client_id=${this.appId}&redirect_uri=${this.callbackUrl}&state=${state}&scope=${scope}&response_type=code`;

    this.logger.log(`Generated auth URL for user ${userId}`);
    return authUrl;
  }

  async handleCallback(
    userId: string,
    code: string,
    state: string
  ): Promise<void> {
    const storedState = this.stateStore.get(state);
    if (
      !storedState ||
      storedState.userId !== userId ||
      storedState.expires < Date.now()
    ) {
      this.stateStore.delete(state);
      throw new ForbiddenException(
        'Invalid or expired state parameter. Possible CSRF attack.'
      );
    }
    this.stateStore.delete(state);

    try {
      const userAccessToken = await this.exchangeCodeForUserAccessToken(code);
      const pages = await this.getUserPages(userAccessToken);

      this.pendingConnections.set(userId, {
        userAccessToken,
        pages,
        expires: Date.now() + 5 * 60 * 1000, // 5 phút để hoàn tất
      });
    } catch (error) {
      this.handleFacebookError(error, 'Failed to handle Facebook callback');
    }
  }

  getPendingPages(userId: string): PendingPagesDto {
    const pending = this.pendingConnections.get(userId);
    if (!pending || pending.expires < Date.now()) {
      this.pendingConnections.delete(userId);
      throw new NotFoundException(
        'No pending connection found or connection has expired.'
      );
    }
    return { pages: pending.pages };
  }

  async connectPages(
    userId: string,
    dto: ConnectPagesDto
  ): Promise<ConnectPagesResult> {
    const pending = this.pendingConnections.get(userId);
    if (!pending || pending.expires < Date.now()) {
      this.pendingConnections.delete(userId);
      throw new BadRequestException(
        'Connection process has expired. Please start over.'
      );
    }
    const { userAccessToken } = pending;

    const succeeded: Partial<ConnectedPage>[] = [];
    const failed: {
      facebookPageId: string;
      pageName: string;
      error: string;
    }[] = [];
    const pagesToConnect = dto.pages;
    const pageIds = pagesToConnect.map((p) => p.facebookPageId);

    // Kiểm tra tất cả các trang đã được kết nối bởi người dùng khác hay chưa
    const existingPages = await this.pageRepository.find({
      where: { facebookPageId: In(pageIds) },
    });

    for (const page of pagesToConnect) {
      const existing = existingPages.find(
        (p) => p.facebookPageId === page.facebookPageId
      );
      if (existing) {
        failed.push({
          ...page,
          error: 'This page is already connected to another account.',
        });
      }
    }

    // Nếu có lỗi, trả về ngay lập tức, không thực hiện giao dịch
    if (failed.length > 0) {
      // Xóa cache vì phiên kết nối đã được sử dụng một phần
      this.pendingConnections.delete(userId);
      return { succeeded, failed };
    }

    // Bắt đầu giao dịch CSDL
    await this.entityManager.transaction(async (transactionManager) => {
      for (const page of pagesToConnect) {
        try {
          const pageAccessToken = await this.getLongLivedPageAccessToken(
            userAccessToken,
            page.facebookPageId
          );
          const encryptedPageAccessToken =
            this.encryptionService.encrypt(pageAccessToken);

          const newConnectedPage = transactionManager.create(ConnectedPage, {
            userId,
            facebookPageId: page.facebookPageId,
            pageName: page.pageName,
            encryptedPageAccessToken,
          });

          const savedPage = await transactionManager.save(newConnectedPage);
          await this.subscribePageToWebhooks(
            page.facebookPageId,
            pageAccessToken
          );

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { encryptedPageAccessToken: _, ...result } = savedPage;
          succeeded.push(result);
        } catch (error) {
          // Nếu có bất kỳ lỗi nào, ném ra để rollback toàn bộ giao dịch
          this.logger.error(
            `Failed to connect page ${page.facebookPageId} for user ${userId}. Rolling back transaction.`,
            error.stack
          );
          throw new InternalServerErrorException(
            `Failed to connect page ${page.pageName}.`
          );
        }
      }
    });

    // Nếu giao dịch thành công (không có lỗi nào được ném ra), xóa cache
    this.pendingConnections.delete(userId);

    return { succeeded, failed };
  }

  getFrontendSelectPageUrl(): string {
    return this.frontendSelectPageUrl;
  }

  async listConnectedPages(userId: string): Promise<ConnectedPage[]> {
    const pages = await this.pageRepository.find({
      where: { userId },
      select: ['id', 'facebookPageId', 'pageName', 'createdAt', 'updatedAt'],
    });
    return pages;
  }

  async disconnectPage(userId: string, id: string): Promise<void> {
    const page = await this.pageRepository.findOne({ where: { id, userId } });
    if (!page) {
      throw new NotFoundException(
        `Connected page with ID ${id} not found for this user.`
      );
    }

    try {
      const pageAccessToken = this.encryptionService.decrypt(
        page.encryptedPageAccessToken
      );
      await this.unsubscribePageFromWebhooks(
        page.facebookPageId,
        pageAccessToken
      );
    } catch (error) {
      this.logger.error(
        `Could not unsubscribe webhooks for page ${page.facebookPageId}, but proceeding with deletion. Error: ${error.message}`
      );
    }

    await this.pageRepository.delete({ id, userId });
  }

  private async exchangeCodeForUserAccessToken(code: string): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
    const params = {
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.callbackUrl,
      code,
    };
    const response = await firstValueFrom(
      this.httpService.get(url, { params })
    );
    return response.data.access_token;
  }

  private async getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
    const url = `https://graph.facebook.com/${this.apiVersion}/me/accounts`;
    const params = { access_token: userAccessToken, fields: 'id,name' };
    const response = await firstValueFrom(
      this.httpService.get(url, { params })
    );
    return response.data.data;
  }

  private async getLongLivedPageAccessToken(
    userAccessToken: string,
    pageId: string
  ): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${pageId}`;
    const params = { access_token: userAccessToken, fields: 'access_token' };
    const response = await firstValueFrom(
      this.httpService.get<FacebookPageWithToken>(url, { params })
    );
    return response.data.access_token;
  }

  private async subscribePageToWebhooks(
    pageId: string,
    pageAccessToken: string
  ): Promise<void> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${pageId}/subscribed_apps`;
    const params = {
      subscribed_fields: 'messages,feed',
      access_token: pageAccessToken,
    };
    await firstValueFrom(this.httpService.post(url, null, { params }));
    this.logger.log(`Successfully subscribed page ${pageId} to webhooks.`);
  }

  private async unsubscribePageFromWebhooks(
    pageId: string,
    pageAccessToken: string
  ): Promise<void> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${pageId}/subscribed_apps`;
    const params = { access_token: pageAccessToken };
    await firstValueFrom(this.httpService.delete(url, { params }));
    this.logger.log(`Successfully unsubscribed page ${pageId} from webhooks.`);
  }

  private handleFacebookError(error: any, context: string): never {
    if (error instanceof AxiosError && error.response) {
      const fbError = error.response.data?.error;
      this.logger.error(
        `${context}: [${fbError?.type}] ${fbError?.message}`,
        error.stack
      );
      throw new InternalServerErrorException(
        fbError?.message ||
          'An error occurred while communicating with Facebook.'
      );
    }
    this.logger.error(`${context}: ${error.message}`, error.stack);
    throw new InternalServerErrorException('An internal error occurred.');
  }
}
