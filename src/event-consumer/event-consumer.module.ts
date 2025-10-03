// src/event-consumer/event-consumer.module.ts

import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventConsumerService } from './event-consumer.service';
import { InboxModule } from '../inbox/inbox.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SQSClient } from '@aws-sdk/client-sqs';
import { GatewayModule } from 'src/gateway/gateway.module';

export const LIVE_CHAT_EVENTS_QUEUE = 'live-chat-events-queue';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GatewayModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('PSQL_HOST'),
        port: configService.get<number>('PSQL_PORT'),
        username: configService.get<string>('PSQL_USER'),
        password: configService.get<string>('PSQL_PASSWORD'),
        database: configService.get<string>('PSQL_DATABASE'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      }),
    }),
    InboxModule,
  ],
  providers: [
    EventConsumerService,
    Logger,
    {
      provide: SQSClient,
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('AWS_SQS_ENDPOINT');
        return new SQSClient({
          region: configService.get<string>('AWS_REGION') as string,
          credentials: {
            accessKeyId: configService.get<string>(
              'AWS_ACCESS_KEY_ID'
            ) as string,
            secretAccessKey: configService.get<string>(
              'AWS_SECRET_ACCESS_KEY'
            ) as string,
          },
          ...(endpoint && { endpoint }),
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class EventConsumerModule {}
