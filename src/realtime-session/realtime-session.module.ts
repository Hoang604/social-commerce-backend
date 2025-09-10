// src/realtime-session/realtime-session.module.ts
import { Module } from '@nestjs/common';
import { RealtimeSessionService } from './realtime-session.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [RealtimeSessionService],
  exports: [RealtimeSessionService],
})
export class RealtimeSessionModule {}
