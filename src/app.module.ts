import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InboxModule } from './inbox/inbox.module';
import { GatewayModule } from './gateway/gateway.module';
import { BillingModule } from './billing/billing.module';
import { UsageModule } from './usage/usage.module';
import { RbacModule } from './rbac/rbac.module';
import { ProjectModule } from './projects/project.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { HttpModule } from '@nestjs/axios';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommonModule } from './common/common.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import {
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
  RedisModule,
} from './redis/redis.module';
import { RedisClientType } from 'redis';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [RedisModule],
      useFactory: async (redisClient: RedisClientType) => {
        return {
          store: redisStore,
          client: redisClient,
        };
      },
      inject: [REDIS_PUBLISHER_CLIENT],
    }),

    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('PSQL_HOST') || 'localhost',
        port: configService.get<number>('PSQL_PORT') || 5432,
        username: configService.get<string>('PSQL_USER') || 'hoang',
        password: configService.get<string>('PSQL_PASSWORD') || '',
        database: configService.get<string>('PSQL_DATABASE') || 'your_database',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      }),
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RedisModule,
    AuthModule,
    UserModule,
    InboxModule,
    GatewayModule,
    BillingModule,
    UsageModule,
    RbacModule,
    ProjectModule,
    CommonModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure() {}
}
