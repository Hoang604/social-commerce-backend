import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { EventProducerModule } from 'src/event-producer/event-producer.module';
import { RealtimeSessionModule } from 'src/realtime-session/realtime-session.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    EventProducerModule,
    RealtimeSessionModule,
  ],
  providers: [EventsGateway, WsJwtAuthGuard],
  exports: [EventsGateway],
})
export class GatewayModule {}
