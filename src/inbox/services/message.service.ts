// src/inbox/services/message.service.ts

import { EntityManager, Repository } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EventsGateway } from 'src/gateway/events.gateway';
import { User } from 'src/user/entities/user.entity';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ListMessagesDto } from '../dto/list-messages.dto';
import { Conversation } from '../entities/conversation.entity';

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
    replyText: string,
    visitorId: string // Cần visitorId để biết người nhận
    // visitorSocketId: string // SocketId sẽ được quản lý bởi Gateway, không cần truyền vào đây
  ): Promise<Message> {
    // Lưu ý: Cần thêm logic để lấy visitorSocketId từ một nơi quản lý session, ví dụ Redis
    // Tạm thời hardcode để minh họa
    const visitorSocketId = 'some-socket-id-of-the-visitor';

    const message = this.messageRepository.create({
      conversationId: conversationId,
      content: replyText,
      senderId: user.id, // ID của nhân viên gửi tin
      recipientId: visitorId, // ID của khách truy cập
      fromCustomer: false,
      status: MessageStatus.SENDING,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Phát sự kiện qua Gateway để đẩy tin nhắn xuống widget
    this.eventsGateway.sendReplyToVisitor(visitorSocketId, savedMessage);

    // Cập nhật trạng thái tin nhắn thành "sent" sau khi gửi qua gateway
    savedMessage.status = MessageStatus.SENT;
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
