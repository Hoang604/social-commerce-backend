import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY'
    );
    const queueUrl = this.configService.get<string>(
      'AWS_SQS_WEBHOOK_QUEUE_URL'
    );

    if (!region || !accessKeyId || !secretAccessKey || !queueUrl) {
      throw new Error(
        'Missing required AWS configuration. Please check AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SQS_WEBHOOK_QUEUE_URL environment variables.'
      );
    }

    this.sqs = new SQSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.queueUrl = queueUrl;
  }

  async sendMessage(payload: any, signature: string): Promise<string> {
    const eventId = randomUUID();
    const messageBody = {
      metadata: {
        eventId,
        receivedAt: new Date().toISOString(),
        source: 'facebook_webhook',
        signature,
      },
      payload,
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: payload.entry?.[0]?.id || eventId, // Use Page ID for FIFO grouping if possible
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
