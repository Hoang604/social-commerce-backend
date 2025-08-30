import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Conversation,
  ConversationStatus,
} from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ListConversationsDto } from '../dto/list-conversations.dto';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';

@Injectable()
export class ConversationService {
  constructor(private readonly entityManager: EntityManager) {}

  async findOrCreateByFacebookIds(
    facebookPageId: string,
    participantId: number,
    facebookConversationId: string, // Thêm tham số này
    manager: EntityManager
  ): Promise<Conversation> {
    const connectedPage = await manager.findOne(ConnectedPage, {
      where: { facebookPageId },
    });
    if (!connectedPage) {
      throw new NotFoundException(
        `Connected page with facebookPageId ${facebookPageId} not found.`
      );
    }

    let conversation = await manager.findOne(Conversation, {
      where: {
        connectedPageId: connectedPage.id,
        participantId: participantId,
      },
    });

    if (!conversation) {
      conversation = manager.create(Conversation, {
        connectedPageId: connectedPage.id,
        participantId: participantId,
        facebookConversationId:
          facebookConversationId || `${facebookPageId}_${participantId}`, // Tạo ID giả nếu chưa có
      });
      await manager.save(conversation);
    }
    return conversation;
  }

  async updateMetadata(
    conversationId: number,
    lastMessage: Message,
    unreadIncrement: number,
    manager: EntityManager
  ): Promise<void> {
    await manager.increment(
      Conversation,
      { id: conversationId },
      'unreadCount',
      unreadIncrement
    );
    await manager.update(
      Conversation,
      { id: conversationId },
      {
        lastMessageSnippet: lastMessage.content?.substring(0, 100),
        lastMessageTimestamp: lastMessage.createdAtFacebook,
        status: ConversationStatus.OPEN,
      }
    );
  }

  async listByPage(userId: string, query: ListConversationsDto) {
    const { connectedPageId, status, page = 1, limit = 10 } = query;

    const qb = this.entityManager
      .createQueryBuilder(Conversation, 'conversation')
      .leftJoin('conversation.connectedPage', 'connectedPage')
      .leftJoinAndSelect('conversation.participant', 'participant')
      .where('connectedPage.userId = :userId', { userId })
      .andWhere('connectedPage.id = :connectedPageId', { connectedPageId });

    if (status) {
      qb.andWhere('conversation.status = :status', { status });
    }

    qb.orderBy('conversation.lastMessageTimestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async updateStatus(
    conversationId: number,
    status: ConversationStatus
  ): Promise<Conversation> {
    const conversation = await this.entityManager.findOneBy(Conversation, {
      id: conversationId,
    });
    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`
      );
    }
    conversation.status = status;
    return this.entityManager.save(conversation);
  }

  async markAsRead(conversationId: number): Promise<Conversation> {
    const conversation = await this.entityManager.findOneBy(Conversation, {
      id: conversationId,
    });
    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`
      );
    }
    conversation.unreadCount = 0;
    return this.entityManager.save(conversation);
  }
}
