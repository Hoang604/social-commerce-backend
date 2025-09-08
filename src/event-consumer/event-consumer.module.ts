// src/event-consumer/event-consumer.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SqsModule } from '@ssut/nestjs-sqs';
import { EventConsumerService } from './event-consumer.service';
import { InboxModule } from '../inbox/inbox.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// Đổi tên hằng số của hàng đợi để phản ánh đúng mục đích
export const LIVE_CHAT_EVENTS_QUEUE = 'live-chat-events-queue';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    SqsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        consumers: [
          {
            name: LIVE_CHAT_EVENTS_QUEUE, // Sử dụng tên hàng đợi mới
            queueUrl: configService.get<string>('AWS_SQS_QUEUE_URL') as string,
            region: configService.get<string>('AWS_REGION') as string,
            // Các cấu hình khác giữ nguyên
          },
        ],
        producers: [],
      }),
    }),
    // Cấu hình TypeOrm cho worker process
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      }),
    }),
    InboxModule, // Import InboxModule để có thể sử dụng các services của nó
  ],
  providers: [EventConsumerService], // EventConsumerService đã có thể inject các services từ InboxModule
})
export class EventConsumerModule {}
