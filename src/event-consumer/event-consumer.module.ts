// src/event-consumer/event-consumer.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SqsModule } from '@ssut/nestjs-sqs';
import { EventConsumerService } from './event-consumer.service';
import { InboxModule } from '../inbox/inbox.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { GetQueueUrlCommand, SQSClient } from '@aws-sdk/client-sqs';

export const LIVE_CHAT_EVENTS_QUEUE = 'live-chat-events-queue';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SqsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const region = configService.get<string>('AWS_REGION') as string;
        const endpoint = configService.get<string>('AWS_SQS_ENDPOINT');
        const queueName = configService.get<string>(
          'AWS_SQS_QUEUE_NAME'
        ) as string;

        const sqsClient = new SQSClient({
          region,
          endpoint,
          credentials: {
            accessKeyId: configService.get<string>(
              'AWS_ACCESS_KEY_ID'
            ) as string,
            secretAccessKey: configService.get<string>(
              'AWS_SECRET_ACCESS_KEY'
            ) as string,
          },
        });

        const command = new GetQueueUrlCommand({ QueueName: queueName });
        const response = await sqsClient.send(command);
        const queueUrl = response.QueueUrl as string;

        return {
          consumers: [
            {
              name: LIVE_CHAT_EVENTS_QUEUE,
              queueUrl: queueUrl,
              region: region,
              endpoint: endpoint,
              // Credentials are now handled by the SQS client instance of the library
            },
          ],
          producers: [],
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('psql_host') || 'localhost',
        port: configService.get<number>('psql_port') || 5432,
        username: configService.get<string>('psql_user') || 'hoang',
        password: configService.get<string>('psql_password') || '',
        database: configService.get<string>('psql_database') || 'your_database',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: true,
      }),
    }),
    InboxModule,
  ],
  providers: [EventConsumerService],
})
export class EventConsumerModule {}
