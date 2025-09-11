// src/inbox/services/message.service.ts

import { EntityManager } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { EventsGateway } from 'src/gateway/events.gateway';
import { User } from 'src/user/entities/user.entity';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ListMessagesDto } from '../dto/list-messages.dto';
import { Conversation } from '../entities/conversation.entity';
import { RealtimeSessionService } from 'src/realtime-session/realtime-session.service';

// Định nghĩa lại DTO cho việc tạo tin nhắn, loại bỏ các trường Facebook cũ
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
    private readonly eventsGateway: EventsGateway
  ) {}

  /**
   * Tạo một tin nhắn mới, được gọi từ EventConsumerService.
   * Phương thức này được thiết kế để chạy bên trong một transaction.
   */
  async createMessage(
    data: CreateMessagePayload,
    manager: EntityManager
  ): Promise<Message> {
    const message = manager.create(Message, data);
    return manager.save(message);
  }

  /**
   * Gửi tin nhắn trả lời từ nhân viên (agent).
   * Phương thức này được InboxController gọi.
   */
  async sendAgentReply(
    user: User,
    conversationId: number,
    replyText: string
  ): Promise<Message> {
    const savedMessage = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Bước 1: Tìm conversation và visitor liên quan
        const conversation = await transactionalEntityManager.findOne(
          Conversation,
          {
            where: { id: conversationId },
            relations: ['visitor', 'project'],
          }
        );

        if (!conversation || conversation.project.userId !== user.id) {
          throw new ForbiddenException(
            'Access to this conversation is denied.'
          );
        }

        const visitorUid = conversation.visitor.visitorUid;

        // Bước 2: Tạo và lưu tin nhắn vào CSDL
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

    // Các bước sau không tương tác DB, có thể nằm ngoài transaction
    // Bước 3: Tra cứu socket.id từ Redis
    const visitorSocketId = await this.realtimeSessionService.getVisitorSession(
      savedMessage.recipientId
    );

    // Bước 4: Gửi sự kiện real-time và cập nhật trạng thái cuối cùng
    if (visitorSocketId) {
      this.eventsGateway.sendReplyToVisitor(visitorSocketId, savedMessage);
      savedMessage.status = MessageStatus.SENT;
    } else {
      savedMessage.status = MessageStatus.DELIVERED;
    }

    // Cập nhật lại trạng thái tin nhắn
    return this.entityManager.save(savedMessage);
  }

  async listByConversation(
    user: User,
    conversationId: number,
    query: ListMessagesDto
  ): Promise<any> {
    const { limit = 20, cursor } = query;

    // Kiểm tra quyền: Đảm bảo user có quyền truy cập vào conversation này
    const conversation = await this.entityManager.findOne(Conversation, {
      where: { id: conversationId },
      relations: ['project'],
    });

    if (!conversation || conversation.project.userId !== user.id) {
      throw new ForbiddenException('Access to this conversation is denied.');
    }

    const qb = this.entityManager
      .createQueryBuilder(Message, 'message')
      .where('message.conversationId = :conversationId', { conversationId });

    if (cursor) {
      qb.andWhere('message.id < :cursor', { cursor });
    }

    qb.orderBy('message.createdAt', 'DESC').take(limit + 1); // Lấy thêm 1 để kiểm tra hasNextPage

    const messages = await qb.getMany();

    const hasNextPage = messages.length > limit;
    if (hasNextPage) {
      messages.pop(); // Bỏ phần tử thừa
    }

    return {
      data: messages.reverse(), // Hiển thị tin nhắn cũ nhất trước
      hasNextPage,
      nextCursor: hasNextPage ? messages[0].id : null,
    };
  }
}
