// src/event-producer/sqs.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqs: SQSClient;
  private readonly queueName: string;
  private queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('AWS_SQS_ENDPOINT');
    this.queueName = this.configService.get<string>(
      'AWS_SQS_QUEUE_NAME'
    ) as string;

    if (!this.queueName) {
      throw new Error('Missing AWS_SQS_QUEUE_NAME environment variable.');
    }

    this.sqs = new SQSClient({
      region: this.configService.get<string>('AWS_REGION') as string,
      credentials: {
        accessKeyId: this.configService.get<string>(
          'AWS_ACCESS_KEY_ID'
        ) as string,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY'
        ) as string,
      },
      ...(endpoint && { endpoint }),
    });
  }

  // Sử dụng lifecycle hook để lấy URL của hàng đợi khi module khởi tạo
  async onModuleInit() {
    try {
      const command = new GetQueueUrlCommand({ QueueName: this.queueName });
      const response = await this.sqs.send(command);
      this.queueUrl = response.QueueUrl as string;
      this.logger.log(`Successfully connected to SQS queue: ${this.queueUrl}`);
    } catch (error) {
      this.logger.error(
        `Could not get SQS queue URL for ${this.queueName}. Please ensure the queue exists.`,
        error.stack
      );
      throw error;
    }
  }

  // Phương thức sendMessage giờ đây không cần truyền URL nữa
  async sendMessage(payload: any): Promise<string> {
    const eventId = randomUUID();

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(payload),
      MessageGroupId: payload.payload.projectId?.toString() || 'default-group',
      MessageDeduplicationId: eventId,
    });

    try {
      await this.sqs.send(command);
      this.logger.log(`Successfully sent message ${eventId} to SQS.`);
      return eventId;
    } catch (error) {
      this.logger.error(
        `Failed to send message to SQS: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
