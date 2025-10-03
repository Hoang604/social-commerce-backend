import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { InboxController } from './inbox.controller';
import { EncryptionService } from '../common/services/encryption.service';
import { GatewayModule } from '../gateway/gateway.module';
import { VisitorService } from './services/visitor.service';
import { Visitor } from './entities/visitor.entity';
import { RealtimeSessionModule } from 'src/realtime-session/realtime-session.module';
import { ProjectModule } from 'src/projects/project.module';
import { InboxEventHandlerService } from './inbox-event.handler';
import { EventProducerModule } from 'src/event-producer/event-producer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, Visitor]),
    GatewayModule,
    RealtimeSessionModule,
    ProjectModule,
    EventProducerModule,
  ],
  providers: [
    ConversationService,
    MessageService,
    EncryptionService,
    VisitorService,
    InboxEventHandlerService,
  ],
  controllers: [InboxController],
  exports: [ConversationService, MessageService, VisitorService],
})
export class InboxModule {}
