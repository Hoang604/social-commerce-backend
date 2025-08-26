import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { AxiosError } from 'axios';

@Injectable()
export class FacebookApiService {
  private readonly logger = new Logger(FacebookApiService.name);
  private readonly apiVersion: string;
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.apiVersion = this.configService.get<string>(
      'FACEBOOK_API_VERSION',
      'v19.0'
    );
  }

  async sendMessage(
    pageAccessToken: string,
    recipientId: string,
    text: string
  ): Promise<any> {
    const url = `https://graph.facebook.com/${this.apiVersion}/me/messages`;
    const payload = {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    };
    const params = { access_token: pageAccessToken };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { params })
      );
      this.logger.log(`Successfully sent message to ${recipientId}`);
      return response.data;
    } catch (error) {
      this.handleFacebookError(
        error,
        `Failed to send message to ${recipientId}`
      );
    }
  }

  async getUserProfile(
    userId: string,
    pageAccessToken: string
  ): Promise<{ name: string; profile_pic: string | null }> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${userId}`;
    const params = {
      fields: 'name,profile_pic',
      access_token: pageAccessToken,
    };
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Could not fetch profile for user ${userId}. Using default name.`
      );
      // Trả về giá trị mặc định nếu không lấy được thông tin
      return { name: `User ${userId}`, profile_pic: null };
    }
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

  async replyToComment(
    pageAccessToken: string,
    facebookCommentId: string,
    message: string
  ): Promise<{ id: string }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${facebookCommentId}/comments`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { message },
          { params: { access_token: pageAccessToken } }
        )
      );
      return response.data;
    } catch (error) {
      this.handleFacebookError(
        error,
        `Failed to reply to comment ${facebookCommentId}`
      );
    }
  }
}
