import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SqsModule } from '@ssut/nestjs-sqs';
import { WebhookProcessorService } from './webhook-processor.service';
import { InboxModule } from '../inbox/inbox.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const FACEBOOK_WEBHOOK_QUEUE = 'facebook-webhook-queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    SqsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        consumers: [
          {
            name: FACEBOOK_WEBHOOK_QUEUE, // Sử dụng tên định danh
            queueUrl: configService.get<string>('AWS_SQS_WEBHOOK_QUEUE_URL')!,
            region: configService.get<string>('AWS_REGION')!,
            batchSize: 10,
            // Cấu hình AWS credentials tại đây nếu cần
            sqs: new (require('aws-sdk/clients/sqs'))({
              region: configService.get<string>('AWS_REGION'),
              credentials: {
                accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID'),
                secretAccessKey: configService.get<string>(
                  'AWS_SECRET_ACCESS_KEY'
                ),
              },
            }),
          },
        ],
        producers: [],
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('psql_host'),
        port: configService.get<number>('psql_port'),
        username: configService.get<string>('psql_user'),
        password: configService.get<string>('psql_password'),
        database: configService.get<string>('psql_database'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      }),
    }),
    InboxModule,
  ],
  providers: [WebhookProcessorService],
})
export class WebhookProcessorModule {}
