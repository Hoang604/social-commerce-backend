import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { Conversation } from 'src/inbox/entities/conversation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visitor } from 'src/inbox/entities/visitor.entity';
import { InboxModule } from 'src/inbox/inbox.module';
import { EventProducerModule } from 'src/event-producer/event-producer.module';
import { RealtimeSessionModule } from 'src/realtime-session/realtime-session.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    forwardRef(() => InboxModule),
    TypeOrmModule.forFeature([Conversation, Visitor]),
    EventProducerModule,
    RealtimeSessionModule,
  ],
  providers: [EventsGateway, WsJwtAuthGuard],
  exports: [EventsGateway],
})
export class GatewayModule {}
