import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { Comment } from './entities/comment.entity';
import { FacebookParticipant } from './entities/facebook-participant.entity';
import { ParticipantService } from './services/participant.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { InboxEventHandlerService } from './services/inbox-event-handler.service';
import { InboxController } from './inbox.controller';
import { FacebookApiModule } from '../facebook-api/facebook-api.module';
import { ConnectedPage } from '../facebook-connect/entities/connected-page.entity';
import { EncryptionService } from '../common/services/encryption.service';
import { EventEmitterModule } from '@nestjs/event-emitter'; // <-- Bổ sung import

@Module({
  imports: [
    EventEmitterModule.forRoot(), // <-- Thêm module này
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      Comment,
      FacebookParticipant,
      ConnectedPage,
    ]),
    FacebookApiModule,
  ],
  providers: [
    ParticipantService,
    ConversationService,
    MessageService,
    InboxEventHandlerService,
    EncryptionService,
  ],
  controllers: [InboxController],
  exports: [InboxEventHandlerService],
})
export class InboxModule {}
