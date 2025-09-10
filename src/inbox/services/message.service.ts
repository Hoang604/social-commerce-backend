// src/inbox/services/message.service.ts

import { EntityManager, Repository } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { InjectRepository } from '@nestjs/typeorm';
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
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
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
    const messageRepo = manager.getRepository(Message);
    const message = messageRepo.create(data);
    return messageRepo.save(message);
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
    // Bước 1: Tìm conversation và visitor liên quan
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['visitor', 'project'],
    });

    if (!conversation || conversation.project.userId !== user.id) {
      throw new ForbiddenException('Access to this conversation is denied.');
    }

    const visitorUid = conversation.visitor.visitorUid;

    // Bước 2: Tạo và lưu tin nhắn vào CSDL
    const message = this.messageRepository.create({
      conversation: { id: conversationId },
      content: replyText,
      senderId: user.id.toString(),
      recipientId: visitorUid,
      fromCustomer: false,
      status: MessageStatus.SENDING,
    });
    let savedMessage = await this.messageRepository.save(message);

    // Bước 3: Tra cứu socket.id từ Redis
    const visitorSocketId =
      await this.realtimeSessionService.getVisitorSession(visitorUid);

    // Bước 4: Gửi sự kiện real-time NẾU visitor đang online
    if (visitorSocketId) {
      this.eventsGateway.sendReplyToVisitor(visitorSocketId, savedMessage);
      savedMessage.status = MessageStatus.SENT;
    } else {
      savedMessage.status = MessageStatus.DELIVERED;
    }

    // Cập nhật lại trạng thái tin nhắn
    return this.messageRepository.save(savedMessage);
  }

  async listByConversation(
    user: User,
    conversationId: number,
    query: ListMessagesDto
  ): Promise<any> {
    const { limit = 20, cursor } = query;

    // Kiểm tra quyền: Đảm bảo user có quyền truy cập vào conversation này
    const conversation = await this.messageRepository.manager.findOne(
      Conversation,
      {
        where: { id: conversationId },
        relations: ['project'],
      }
    );

    if (!conversation || conversation.project.userId !== user.id) {
      throw new ForbiddenException('Access to this conversation is denied.');
    }

    const qb = this.messageRepository
      .createQueryBuilder('message')
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
      data: messages,
      hasNextPage,
      nextCursor: hasNextPage ? messages[messages.length - 1].id : null,
    };
  }
}
