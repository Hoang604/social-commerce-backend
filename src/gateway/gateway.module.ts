import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { JwtService } from '@nestjs/jwt';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { SqsService } from 'src/event-producer/sqs.service';

@Module({
  imports: [AuthModule, UserModule],
  providers: [
    EventsGateway,
    WsJwtAuthGuard,
    JwtService, // Provide JwtService for the guard
    SqsService,
  ],
  exports: [EventsGateway], // Export if other modules need to call it directly (though event-driven is preferred)
})
export class GatewayModule {}
