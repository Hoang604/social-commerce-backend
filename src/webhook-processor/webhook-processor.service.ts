import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import type { Message } from 'aws-sdk/clients/sqs'; // Sử dụng type từ aws-sdk v2
import { InboxEventHandlerService } from '../inbox/services/inbox-event-handler.service';
import { FACEBOOK_WEBHOOK_QUEUE } from './webhook-processor.module';

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(private readonly inboxEventHandler: InboxEventHandlerService) {}

  @SqsMessageHandler(FACEBOOK_WEBHOOK_QUEUE) // Truyền tên queue vào decorator
  public async handleMessage(message: Message) {
    this.logger.log(`Received SQS message: ${message.MessageId}`);
    try {
      if (!message.Body) {
        throw new Error('Message body is empty.');
      }
      const parsedBody = JSON.parse(message.Body);
      const webhookPayload = parsedBody.payload;

      await this.inboxEventHandler.handleFacebookEvent(webhookPayload);

      this.logger.log(`Successfully processed message ${message.MessageId}`);
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.MessageId}: ${error.message}`,
        error.stack
      );
      throw error; // Ném lỗi để SQS xử lý retry và DLQ
    }
  }
}
