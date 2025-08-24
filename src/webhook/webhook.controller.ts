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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { WebhookVerificationDto } from './webhook.dto';
import { WebhookService } from './webhook.service';

@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
    private readonly eventEmitter: EventEmitter2
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
  handleEvent(@Req() req: Request, @Body() body: any) {
    const signature = req.headers['x-hub-signature-256'] as string;
    // 'rawBody' được gắn vào request bởi RawBodyMiddleware của chúng ta
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      this.logger.error(
        'Raw body is missing. Ensure RawBodyMiddleware is applied correctly for this route.'
      );
      throw new ForbiddenException('Invalid request format');
    }

    if (!this.webhookService.verifySignature(signature, rawBody)) {
      throw new ForbiddenException('Invalid signature');
    }

    this.logger.log('Received valid webhook event');
    // Phát sự kiện để xử lý bất đồng bộ
    this.eventEmitter.emit('facebook.event.received', body);

    // Phản hồi ngay lập tức cho Facebook
    return 'EVENT_RECEIVED';
  }
}
