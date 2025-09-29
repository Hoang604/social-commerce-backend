// src/realtime-session/realtime-session.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { type RedisClientType } from 'redis';
import { REDIS_PUBLISHER_CLIENT } from '../redis/redis.module';
import { Logger } from '@nestjs/common';

@Injectable()
export class RealtimeSessionService {
  private readonly logger = new Logger(RealtimeSessionService.name);
  constructor(
    @Inject(REDIS_PUBLISHER_CLIENT) private readonly redis: RedisClientType
  ) {}

  private getKey(visitorUid: string): string {
    this.logger.log(`Generating key for visitorUid: ${visitorUid}`);
    return `session:visitor:${visitorUid}`;
  }

  async setVisitorSession(visitorUid: string, socketId: string): Promise<void> {
    this.logger.log(
      `Setting session for visitorUid: ${visitorUid} with socketId: ${socketId}`
    );
    const key = this.getKey(visitorUid);
    await this.redis.set(key, socketId);
    await this.redis.expire(key, 3 * 24 * 60 * 60); // Expire in 3 days
  }

  async getVisitorSession(visitorUid: string): Promise<string | null> {
    this.logger.log(`Getting session for visitorUid: ${visitorUid}`);
    const key = this.getKey(visitorUid);
    return this.redis.get(key);
  }

  async deleteVisitorSession(visitorUid: string): Promise<void> {
    this.logger.log(`Deleting session for visitorUid: ${visitorUid}`);
    const key = this.getKey(visitorUid);
    await this.redis.del(key);
  }
}
