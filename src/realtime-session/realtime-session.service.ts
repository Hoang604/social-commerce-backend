// src/realtime-session/realtime-session.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { type RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RealtimeSessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  private getKey(visitorUid: string): string {
    return `session:visitor:${visitorUid}`;
  }

  async setVisitorSession(visitorUid: string, socketId: string): Promise<void> {
    const key = this.getKey(visitorUid);
    // Lưu session trong 12 giờ (43200 giây)
    await this.redis.set(key, socketId, { EX: 43200 });
  }

  async getVisitorSession(visitorUid: string): Promise<string | null> {
    const key = this.getKey(visitorUid);
    return this.redis.get(key);
  }

  async deleteVisitorSession(visitorUid: string): Promise<void> {
    const key = this.getKey(visitorUid);
    await this.redis.del(key);
  }
}
