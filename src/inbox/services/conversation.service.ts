import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Conversation,
  ConversationStatus,
} from '../entities/conversation.entity';
import { ListConversationsDto } from '../dto/list-conversations.dto';
import { User } from 'src/user/entities/user.entity';
import { RealtimeSessionService } from 'src/realtime-session/realtime-session.service';
import { EventsGateway } from 'src/gateway/events.gateway';

@Injectable()
export class ConversationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly realtimeSessionService: RealtimeSessionService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway
  ) {}

  async findById(id: number): Promise<Conversation> {
    const conversation = await this.entityManager.findOne(Conversation, {
      where: { id },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found.`);
    }
    return conversation;
  }

  /**
   * Finds an existing conversation for a visitor or creates a new one.
   * This is intended to be called from the EventConsumer within a transaction.
   * @param projectId - The ID of the project.
   * @param visitorId - The ID of the visitor.
   * @param manager - The EntityManager from the transaction.
   * @returns The found or newly created Conversation.
   */
  async findOrCreateByVisitorId(
    projectId: number,
    visitorId: number,
    manager: EntityManager
  ): Promise<Conversation> {
    const conversationRepo = manager.getRepository(Conversation);

    let conversation = await conversationRepo.findOne({
      where: {
        project: { id: projectId },
        visitor: { id: visitorId },
      },
    });

    if (!conversation) {
      conversation = conversationRepo.create({
        project: { id: projectId },
        visitor: { id: visitorId },
        status: ConversationStatus.OPEN,
      });
      await conversationRepo.save(conversation);
    }
    return conversation;
  }

  /**
   * Updates the conversation's metadata after a new message is received.
   * Intended to be called from the EventConsumer within a transaction.
   * @param conversationId - The ID of the conversation to update.
   * @param lastMessageSnippet - A snippet of the last message.
   * @param lastMessageTimestamp - The timestamp of the last message.
   * @param manager - The EntityManager from the transaction.
   */
  async updateLastMessage(
    conversationId: number,
    lastMessageSnippet: string,
    lastMessageTimestamp: Date,
    manager: EntityManager
  ): Promise<void> {
    const conversationRepo = manager.getRepository(Conversation);
    // Increment unread count by 1 for new incoming messages
    await conversationRepo.increment({ id: conversationId }, 'unreadCount', 1);

    await conversationRepo.update(
      { id: conversationId },
      {
        lastMessageSnippet: lastMessageSnippet.substring(0, 100),
        lastMessageTimestamp,
        status: ConversationStatus.OPEN, // Re-open conversation on new message
      }
    );
  }

  /**
   * Lists conversations for a specific project, intended for the agent dashboard.
   * @param user - The authenticated user making the request.
   * @param projectId - The ID of the project to fetch conversations for.
   * @param query - DTO for pagination and filtering.
   * @returns A paginated list of conversations.
   */
  async listByProject(
    user: User,
    projectId: number,
    query: ListConversationsDto
  ) {
    const { status, page = 1, limit = 10 } = query;

    const qb = this.entityManager
      .createQueryBuilder(Conversation, 'conversation')
      .leftJoin('conversation.project', 'project')
      .leftJoinAndSelect('conversation.visitor', 'visitor')
      .where('project.userId = :userId', { userId: user.id })
      .andWhere('project.id = :projectId', { projectId });

    if (status) {
      qb.andWhere('conversation.status = :status', { status });
    }

    qb.orderBy('conversation.lastMessageTimestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Updates the status of a conversation (e.g., 'open', 'closed').
   * @param user - The authenticated user.
   * @param conversationId - The ID of the conversation.
   * @param status - The new status.
   * @returns The updated conversation.
   */
  async updateStatus(
    userId: string,
    conversationId: number,
    status: ConversationStatus
  ): Promise<Conversation> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const conversation = await transactionalEntityManager.findOne(
          Conversation,
          {
            where: { id: conversationId },
            relations: ['project'],
          }
        );

        if (!conversation) {
          throw new NotFoundException(
            `Conversation with ID ${conversationId} not found.`
          );
        }

        if (conversation.project.userId !== userId) {
          throw new ForbiddenException(
            'Access to this conversation is denied.'
          );
        }

        conversation.status = status;
        return transactionalEntityManager.save(conversation);
      }
    );
  }

  /**
   * Marks a conversation as read by resetting its unread count.
   * @param user - The authenticated user.
   * @param conversationId - The ID of the conversation.
   * @returns The updated conversation.
   */
  async markAsRead(
    userId: string,
    conversationId: number
  ): Promise<Conversation> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const conversation = await transactionalEntityManager.findOne(
          Conversation,
          {
            where: { id: conversationId },
            relations: ['project'],
          }
        );

        if (!conversation) {
          throw new NotFoundException(
            `Conversation with ID ${conversationId} not found.`
          );
        }

        if (conversation.project.userId !== userId) {
          throw new ForbiddenException(
            'Access to this conversation is denied.'
          );
        }

        conversation.unreadCount = 0;
        return transactionalEntityManager.save(conversation);
      }
    );
  }

  /**
   * @NEW
   * Gets the active conversation and its recent messages for a given visitor ID.
   * Intended for use by the EventsGateway to provide chat history on connect.
   * @param visitorId The ID of the visitor.
   * @returns The Conversation entity with messages, or null if not found.
   */
  async getHistoryByVisitorId(visitorId: number): Promise<Conversation | null> {
    return this.entityManager.findOne(Conversation, {
      where: {
        visitor: { id: visitorId },
        status: ConversationStatus.OPEN, // Optional: only get open conversations
      },
      relations: ['messages'], // Eagerly load messages
      order: {
        messages: {
          createdAt: 'ASC', // Order messages chronologically
        },
      },
    });
  }

  /**
   * @NEW_FEATURE
   * Handles and emits "agent typing" event to the visitor.
   */
  async handleAgentTyping(
    user: User,
    conversationId: number,
    isTyping: boolean
  ): Promise<void> {
    // Step 1: Check permissions and get visitor information
    const conversation = await this.entityManager.findOne(Conversation, {
      where: { id: conversationId },
      relations: ['visitor', 'project'],
    });

    if (!conversation || conversation.project.userId !== user.id) {
      throw new ForbiddenException('Access to this conversation is denied.');
    }

    const visitorUid = conversation.visitor.visitorUid;

    // Step 2: Look up visitor's socket.id
    const visitorSocketId =
      await this.realtimeSessionService.getVisitorSession(visitorUid);

    // Step 3: Send event IF visitor is online
    if (visitorSocketId) {
      this.eventsGateway.sendAgentTypingToVisitor(
        visitorSocketId,
        isTyping,
        user.fullName || 'Agent' // Use fullName or a default name
      );
    }
  }
}