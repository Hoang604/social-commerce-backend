// src/realtime-session/realtime-session.module.ts
import { Module } from '@nestjs/common';
import { RealtimeSessionService } from './realtime-session.service';

@Module({
  providers: [RealtimeSessionService],
  exports: [RealtimeSessionService],
})
export class RealtimeSessionModule {}
