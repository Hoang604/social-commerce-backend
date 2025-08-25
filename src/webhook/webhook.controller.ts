import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
  ValidationPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { WebhookVerificationDto } from './webhook.dto';
import { WebhookService } from './webhook.service';
import { SqsService } from './sqs.service';

@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
    private readonly sqsService: SqsService
  ) {
    // Lấy verify token từ config service
    const token = this.configService.get<string>('FACEBOOK_VERIFY_TOKEN');

    // Kiểm tra xem token có tồn tại không. Nếu không, ném lỗi để ứng dụng không thể khởi động.
    // Đây là một "fail-fast" strategy quan trọng.
    if (!token) {
      throw new Error(
        'FACEBOOK_VERIFY_TOKEN is not defined in environment variables'
      );
    }
    this.verifyToken = token;
  }

  @Get()
  verify(@Query(new ValidationPipe()) query: WebhookVerificationDto) {
    this.logger.log('Received webhook verification request');
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === this.verifyToken
    ) {
      this.logger.log('Webhook verification successful');
      return query['hub.challenge'];
    }
    this.logger.warn('Webhook verification failed');
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(@Req() req: Request, @Body() body: any) {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      this.logger.error('Raw body is missing.');
      throw new ForbiddenException('Invalid request format');
    }

    if (!this.webhookService.verifySignature(signature, rawBody)) {
      throw new ForbiddenException('Invalid signature');
    }

    try {
      // Thay thế EventEmitter bằng SqsService
      await this.sqsService.sendMessage(body, signature);
      this.logger.log('Webhook event successfully queued.');
      return 'EVENT_RECEIVED';
    } catch (error) {
      // Nếu không thể gửi vào queue, đây là lỗi nghiêm trọng phía server
      this.logger.error(
        'CRITICAL: Could not queue webhook event.',
        error.stack
      );
      throw new InternalServerErrorException(
        'Failed to process webhook event.'
      );
    }
  }
}
