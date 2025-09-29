// src/event-consumer/event-consumer.service.ts

// src/event-consumer/event-consumer.service.ts

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ConversationService } from '../inbox/services/conversation.service';
import { VisitorService } from '../inbox/services/visitor.service';
import { MessageService } from '../inbox/services/message.service';
import { MessageStatus } from '../inbox/entities/message.entity';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { type Redis } from 'ioredis';
import { REDIS_PUBLISHER_CLIENT } from 'src/redis/redis.module';

// Define a constant for the channel name for easier management
const NEW_MESSAGE_CHANNEL = 'new_message_channel';

@Injectable()
export class EventConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventConsumerService.name);
  private queueUrl: string;
  private readonly queueName: string;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly visitorService: VisitorService,
    private readonly messageService: MessageService,
    private readonly entityManager: EntityManager,
    @Inject(REDIS_PUBLISHER_CLIENT) private readonly redisPublisher: Redis,
    private readonly sqs: SQSClient,
    private readonly configService: ConfigService
  ) {
    this.queueName = this.configService.get<string>(
      'AWS_SQS_QUEUE_NAME'
    ) as string;
  }

  async onApplicationBootstrap() {
    this.logger.log(
      'Application has fully started. Initializing SQS consumer...'
    );
    try {
      const command = new GetQueueUrlCommand({ QueueName: this.queueName });
      const response = await this.sqs.send(command);
      this.queueUrl = response.QueueUrl as string;
      this.logger.log(`Successfully connected to SQS queue: ${this.queueUrl}`);
      this.startPolling();
    } catch (error) {
      this.logger.error(
        `Could not get SQS queue URL for ${this.queueName}. Please ensure the queue exists.`,
        error.stack
      );
      throw error;
    }
  }

  private startPolling() {
    this.logger.log('Starting SQS polling...');
    const poll = async () => {
      while (true) {
        try {
          const receiveCommand = new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          });
          const { Messages } = await this.sqs.send(receiveCommand);

          if (Messages) {
            this.logger.log(`Received ${Messages.length} messages.`);
            for (const message of Messages) {
              await this.handleMessage(message);
              const deleteCommand = new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle,
              });
              await this.sqs.send(deleteCommand);
            }
          }
        } catch (error) {
          this.logger.error('Error polling SQS:', error);
        }
      }
    };

    poll();
  }

  public async handleMessage(message: Message) {
    this.logger.log(`Received SQS message: ${message.MessageId}`);
    try {
      if (message.Body) {
        this.logger.debug(`Message Body: ${message.Body}`);
      } else {
        this.logger.warn(
          `Message ${message.MessageId} has no body. Skipping processing.`
        );
        throw new Error('Message body is empty.');
      }

      const event = JSON.parse(message.Body);
      const { type, payload } = event;

      if (type === 'NEW_MESSAGE_FROM_VISITOR') {
        await this.handleNewMessageFromVisitor(payload);
      } else {
        this.logger.warn(`Unhandled event type: ${type}`);
      }

      this.logger.log(`Successfully processed message ${message.MessageId}`);
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.MessageId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async handleNewMessageFromVisitor(payload: {
    content: string;
    visitorUid: string;
    projectId: number;
    socketId: string;
  }) {
    this.logger.log(`Handling new message from visitor: ${payload.visitorUid}`);
    const { visitorUid, projectId, content } = payload;

    let savedMessage: any = null;

    await this.entityManager.transaction(async (manager) => {
      this.logger.log(`[Transaction] Started for visitor: ${visitorUid}`);
      const visitor = await this.visitorService.findOrCreateByUid(
        projectId,
        visitorUid,
        manager
      );
      this.logger.log(`[Transaction] Found or created visitor: ${visitor.id}`);

      const conversation =
        await this.conversationService.findOrCreateByVisitorId(
          projectId,
          visitor.id,
          manager
        );
      this.logger.log(
        `[Transaction] Found or created conversation: ${conversation.id}`
      );

      savedMessage = await this.messageService.createMessage(
        {
          conversationId: conversation.id,
          content: content,
          senderId: visitor.visitorUid,
          recipientId: `project_${projectId}`,
          fromCustomer: true,
          status: MessageStatus.SENT,
        },
        manager
      );
      this.logger.log(`[Transaction] Created message: ${savedMessage.id}`);

      await this.conversationService.updateLastMessage(
        conversation.id,
        content,
        new Date(),
        manager
      );
      this.logger.log(
        `[Transaction] Updated last message for conversation: ${conversation.id}`
      );
    });
    if (savedMessage) {
      this.logger.log(
        `Publishing message event for message: ${savedMessage.id}`
      );
      this.redisPublisher.publish(
        NEW_MESSAGE_CHANNEL,
        JSON.stringify(savedMessage)
      );
    } else {
      this.logger.error('Failed to save message from visitor.');
      throw new Error('Failed to save message from visitor.');
    }
  }
}
