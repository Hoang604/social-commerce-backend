// src/inbox/services/message.service.ts

import { EntityManager } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { EventsGateway } from 'src/gateway/events.gateway';
import { User } from 'src/user/entities/user.entity';
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListMessagesDto } from '../dto/list-messages.dto';
import { Conversation } from '../entities/conversation.entity';
import { RealtimeSessionService } from 'src/realtime-session/realtime-session.service';
import { ProjectService } from 'src/projects/project.service';

// Redefine DTO for message creation, removing old Facebook fields
interface CreateMessagePayload {
  conversationId: number;
  content: string;
  attachments?: any;
  senderId: string;
  recipientId: string;
  fromCustomer: boolean;
  status?: MessageStatus;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly entityManager: EntityManager,
    private readonly realtimeSessionService: RealtimeSessionService,
    private readonly eventsGateway: EventsGateway,
    private readonly projectService: ProjectService
  ) {
    this.logger.log(`EventGateWay server: ${this.eventsGateway.server}`);
  }

  /**
   * Create a new message, called from EventConsumerService.
   * This method is designed to run inside a transaction.
   */
  async createMessageAndVerifySent(
    tempId: string,
    visitorUid: string,
    data: CreateMessagePayload,
    manager: EntityManager
  ): Promise<Message> {
    const message = manager.create(Message, data);
    const savedMessage = await manager.save(message);

    this.logger.log(
      `Message ${savedMessage.id} created for visitor ${visitorUid}. It will be sent via Redis pub/sub.`,
    );

    return savedMessage;
  }

  /**
   * Send a reply message from an agent.
   * This method is called by InboxController.
   */
  async sendAgentReply(
    user: User,
    conversationId: number,
    replyText: string
  ): Promise<Message> {
    const savedMessage = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Step 1: Find related conversation and visitor
        const conversation = await transactionalEntityManager.findOne(
          Conversation,
          {
            where: { id: conversationId },
            relations: ['visitor', 'project'],
          }
        );

        if (!conversation) {
          throw new NotFoundException(
            `Conversation with ID ${conversationId} not found.`
          );
        }

        await this.projectService.validateProjectMembership(
          conversation.projectId,
          user.id
        );

        const visitorUid = conversation.visitor.visitorUid;

        // Step 2: Create and save message to DB
        const message = transactionalEntityManager.create(Message, {
          conversation: { id: conversationId },
          content: replyText,
          senderId: user.id.toString(),
          recipientId: visitorUid,
          fromCustomer: false,
          status: MessageStatus.SENDING,
        });
        return transactionalEntityManager.save(message);
      }
    );

    // Subsequent steps do not interact with DB, can be outside transaction
    // Step 3: Look up socket.id from Redis
    const visitorSocketId = await this.realtimeSessionService.getVisitorSession(
      savedMessage.recipientId
    );

    // Step 4: Send real-time event and update final status
    if (visitorSocketId) {
      this.eventsGateway.sendReplyToVisitor(visitorSocketId, savedMessage);
      savedMessage.status = MessageStatus.SENT;
    } else {
      savedMessage.status = MessageStatus.DELIVERED;
    }

    this.logger.debug(`message: ${JSON.stringify(savedMessage)}`);

    this.logger.log(
      `Agent reply message ${savedMessage.id} status updated to ${savedMessage.status}`
    );
    // Update message status
    return this.entityManager.save(savedMessage);
  }

  async listByConversation(
    user: User,
    conversationId: number,
    query: ListMessagesDto
  ): Promise<any> {
    const { limit = 20, cursor } = query;

    // Permission check: Ensure user has access to this conversation
    const conversation = await this.entityManager.findOne(Conversation, {
      where: { id: conversationId },
      relations: ['project'],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`
      );
    }

    await this.projectService.validateProjectMembership(
      conversation.projectId,
      user.id
    );

    const qb = this.entityManager
      .createQueryBuilder(Message, 'message')
      .where('message.conversationId = :conversationId', { conversationId });

    if (cursor) {
      qb.andWhere('message.id < :cursor', { cursor });
    }

    qb.orderBy('message.createdAt', 'DESC').take(limit + 1); // Get 1 more to check hasNextPage

    const messages = await qb.getMany();

    const hasNextPage = messages.length > limit;
    if (hasNextPage) {
      messages.pop(); // Remove extra element
    }

    return {
      data: messages.reverse(), // Display oldest messages first
      hasNextPage,
      nextCursor: hasNextPage ? messages[0].id : null,
    };
  }
}
