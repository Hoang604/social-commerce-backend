import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntityManager } from 'typeorm';
import { ParticipantService } from './participant.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class InboxEventHandlerService {
  private readonly logger = new Logger(InboxEventHandlerService.name);

  constructor(
    private readonly participantService: ParticipantService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly facebookApiService: FacebookApiService,
    private readonly encryptionService: EncryptionService,
    private readonly entityManager: EntityManager
  ) {}

  @OnEvent('facebook.event.received')
  async handleFacebookEvent(payload: any) {
    this.logger.log('Processing facebook.event.received');

    for (const entry of payload.entry) {
      for (const messaging of entry.messaging) {
        if (messaging.message) {
          await this.handleNewMessageEvent(messaging);
        } else {
          this.logger.log(`Unhandled event type: ${Object.keys(messaging)}`);
        }
      }
    }
  }

  private async handleNewMessageEvent(messaging: any): Promise<void> {
    await this.entityManager.transaction(async (transactionManager) => {
      const pageRepo = transactionManager.getRepository(ConnectedPage);
      const connectedPage = await pageRepo.findOneBy({
        facebookPageId: messaging.recipient.id,
      });

      if (!connectedPage) {
        this.logger.warn(
          `Received message for an unconnected page: ${messaging.recipient.id}`
        );
        return;
      }

      const pageAccessToken = this.encryptionService.decrypt(
        connectedPage.encryptedPageAccessToken
      );
      const userProfile = await this.facebookApiService.getUserProfile(
        messaging.sender.id,
        pageAccessToken
      );

      const participantData = {
        facebookUserId: messaging.sender.id,
        name: userProfile.name,
        profilePicUrl: userProfile.profile_pic || undefined, // Sửa lỗi null
      };

      const participant = await this.participantService.upsert(
        participantData,
        transactionManager
      );

      const conversation =
        await this.conversationService.findOrCreateByFacebookIds(
          messaging.recipient.id,
          participant.id,
          messaging.conversation?.id, // Truyền conversation ID từ Facebook nếu có
          transactionManager
        );

      const message = await this.messageService.create(
        {
          conversationId: conversation.id,
          facebookMessageId: messaging.message.mid,
          content: messaging.message.text,
          attachments: messaging.message.attachments,
          senderId: messaging.sender.id,
          recipientId: messaging.recipient.id,
          fromCustomer: true,
          createdAtFacebook: new Date(messaging.timestamp),
        },
        transactionManager
      );

      await this.conversationService.updateMetadata(
        conversation.id,
        message,
        1,
        transactionManager
      );

      this.logger.log(
        `Successfully processed message ${message.facebookMessageId} for conversation ${conversation.id}`
      );
    });
  }
}
