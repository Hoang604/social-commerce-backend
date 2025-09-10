import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { JwtService } from '@nestjs/jwt';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { SqsService } from 'src/event-producer/sqs.service';
import { ConversationService } from 'src/inbox/services/conversation.service';
import { VisitorService } from 'src/inbox/services/visitor.service';
import { Conversation } from 'src/inbox/entities/conversation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visitor } from 'src/inbox/entities/visitor.entity';

@Module({
  imports: [
    AuthModule,
    UserModule,
    TypeOrmModule.forFeature([Conversation, Visitor]),
  ],
  providers: [
    EventsGateway,
    ConversationService,
    WsJwtAuthGuard,
    JwtService, // Provide JwtService for the guard
    SqsService,
    VisitorService,
  ],
  exports: [EventsGateway], // Export if other modules need to call it directly (though event-driven is preferred)
})
export class GatewayModule {}
