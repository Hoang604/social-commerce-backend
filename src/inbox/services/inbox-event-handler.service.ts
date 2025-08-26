import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntityManager, Repository } from 'typeorm';
import { ParticipantService } from './participant.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { Comment, CommentStatus } from '../entities/comment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EventsGateway } from 'src/gateway/events.gateway';

// --- Type Definitions for Webhook Payload ---
interface FeedChangeValue {
  item: 'comment' | 'reaction' | string;
  verb: 'add' | 'remove' | string;
  comment_id?: string;
  post_id: string;
  message?: string;
  from: {
    id: string;
    name: string;
  };
  created_time: number;
  parent_id?: string;
}

interface WebhookChange {
  field: 'feed' | 'messages' | string;
  value: any;
}

interface WebhookEntry {
  id: string; // Page ID
  time: number;
  changes: WebhookChange[];
  messaging?: any[]; // For message events
}

interface WebhookPayload {
  object: 'page';
  entry: WebhookEntry[];
}
// --- End Type Definitions ---

@Injectable()
export class InboxEventHandlerService {
  private readonly logger = new Logger(InboxEventHandlerService.name);

  constructor(
    private readonly participantService: ParticipantService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly facebookApiService: FacebookApiService,
    private readonly encryptionService: EncryptionService,
    private readonly entityManager: EntityManager,
    private readonly eventsGateway: EventsGateway,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>
  ) {}

  @OnEvent('facebook.event.received')
  async handleFacebookEvent(payload: WebhookPayload) {
    this.logger.debug('Processing facebook.event.received');

    for (const entry of payload.entry) {
      if (entry.messaging) {
        for (const messaging of entry.messaging) {
          if (messaging.message) {
            await this.handleNewMessageEvent(messaging);
          }
        }
      } else if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === 'feed') {
            await this.handleFeedChangeEvent(change.value, entry.id);
          }
        }
      }
    }
  }

  private async handleFeedChangeEvent(value: FeedChangeValue, pageId: string) {
    if (value.item !== 'comment' || !value.comment_id) {
      return;
    }

    await this.entityManager.transaction(async (tm) => {
      const existingComment = await tm.findOneBy(Comment, {
        facebookCommentId: value.comment_id,
      });

      if (existingComment) {
        this.logger.debug(
          `Comment ${value.comment_id} already exists. Skipping.`
        );
        return;
      }

      const connectedPage = await tm.findOneBy(ConnectedPage, {
        facebookPageId: pageId,
      });

      if (!connectedPage) {
        this.logger.warn(
          `Received webhook for unconnected page ${pageId}. Skipping.`
        );
        return;
      }

      const participant = await this.participantService.upsert(
        { facebookUserId: value.from.id, name: value.from.name },
        tm
      );

      let parentDbComment: Comment | null = null;
      if (value.parent_id && value.parent_id !== value.post_id) {
        parentDbComment = await tm.findOneBy(Comment, {
          facebookCommentId: value.parent_id,
        });
      }

      const newComment = tm.create(Comment, {
        connectedPageId: connectedPage.id,
        facebookCommentId: value.comment_id,
        facebookPostId: value.post_id,
        content: value.message,
        senderId: participant.facebookUserId,
        fromCustomer: true,
        parentCommentId: parentDbComment ? parentDbComment.id : null,
        createdAtFacebook: new Date(value.created_time * 1000),
        status: CommentStatus.RECEIVED,
      });

      await tm.save(newComment);

      this.eventsGateway.sendToUser(
        connectedPage.userId,
        'comment:new',
        newComment
      );

      this.logger.log(`Successfully processed new comment ${newComment.id}`);
    });
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
