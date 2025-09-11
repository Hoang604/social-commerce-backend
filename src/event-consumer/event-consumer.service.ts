// src/event-consumer/event-consumer.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import type { Message as SqsMessage } from 'aws-sdk/clients/sqs';
import { EntityManager } from 'typeorm';
import { ConversationService } from '../inbox/services/conversation.service';
import { VisitorService } from '../inbox/services/visitor.service';
import { MessageService } from '../inbox/services/message.service';
import { LIVE_CHAT_EVENTS_QUEUE } from './event-consumer.module';
import { MessageStatus } from '../inbox/entities/message.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly visitorService: VisitorService,
    private readonly messageService: MessageService,
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @SqsMessageHandler(LIVE_CHAT_EVENTS_QUEUE)
  public async handleMessage(message: SqsMessage) {
    this.logger.log(`Received SQS message: ${message.MessageId}`);
    try {
      if (!message.Body) {
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
    const { visitorUid, projectId, content } = payload;

    const savedMessage = null;

    await this.entityManager.transaction(async (manager) => {
      const visitor = await this.visitorService.findOrCreateByUid(
        projectId,
        visitorUid,
        manager
      );

      const conversation =
        await this.conversationService.findOrCreateByVisitorId(
          projectId,
          visitor.id,
          manager
        );

      const savedMessage = await this.messageService.createMessage(
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

      await this.conversationService.updateLastMessage(
        conversation.id,
        content,
        new Date(),
        manager
      );
    });
    if (savedMessage) {
      this.eventEmitter.emit('message.created', savedMessage);
    } else {
      this.logger.error('Failed to save message from visitor.');
      throw new Error('Failed to save message from visitor.');
    }
  }
}
