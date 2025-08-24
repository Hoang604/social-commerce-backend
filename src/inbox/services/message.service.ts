import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Conversation } from '../entities/conversation.entity';
import { EncryptionService } from '../../common/services/encryption.service';

interface CreateMessageData {
  conversationId: number;
  facebookMessageId?: string;
  content: string;
  attachments?: any;
  senderId: string;
  recipientId: string;
  fromCustomer: boolean;
  createdAtFacebook?: Date;
  status?: MessageStatus;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly facebookApiService: FacebookApiService,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly entityManager: EntityManager
  ) {}

  async create(
    data: CreateMessageData,
    manager: EntityManager
  ): Promise<Message> {
    const repo = manager.getRepository(Message);
    const message = repo.create(data);
    return repo.save(message);
  }

  async sendReply(
    userId: string,
    conversationId: number,
    text: string
  ): Promise<Message> {
    const conversation = await this.entityManager
      .getRepository(Conversation)
      .findOne({
        where: { id: conversationId },
        relations: ['connectedPage', 'participant'],
      });

    if (!conversation || conversation.connectedPage.userId !== userId) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found for this user.`
      );
    }

    const { connectedPage, participant } = conversation;

    // 1. Lưu tin nhắn vào CSDL với trạng thái 'sending'
    const messageData: CreateMessageData = {
      conversationId,
      content: text,
      senderId: connectedPage.facebookPageId,
      recipientId: participant.facebookUserId,
      fromCustomer: false,
      status: MessageStatus.SENDING,
    };
    const message = await this.messageRepository.save(messageData);

    // 2. Phát sự kiện để cập nhật UI ngay lập tức
    this.eventEmitter.emit('message.sending', message);
    this.logger.log(`Message ${message.id} saved with status 'sending'.`);

    try {
      // 3. Gửi tin nhắn qua Facebook API
      const pageAccessToken = this.encryptionService.decrypt(
        connectedPage.encryptedPageAccessToken
      );
      const fbResponse = await this.facebookApiService.sendMessage(
        pageAccessToken,
        participant.facebookUserId,
        text
      );

      // 4a. Cập nhật trạng thái thành 'sent' nếu thành công
      message.status = MessageStatus.SENT;
      message.facebookMessageId = fbResponse.message_id; // Lưu ID từ Facebook
      await this.messageRepository.save(message);
      this.logger.log(
        `Message ${message.id} sent successfully, status updated to 'sent'.`
      );

      // 5a. Phát sự kiện cập nhật trạng thái
      this.eventEmitter.emit('message.status.updated', message);
    } catch (error) {
      this.logger.error(`Failed to send message ${message.id}`, error.stack);
      // 4b. Cập nhật trạng thái thành 'failed' nếu thất bại
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);

      // 5b. Phát sự kiện cập nhật trạng thái
      this.eventEmitter.emit('message.status.updated', message);
    }

    return message;
  }
}
