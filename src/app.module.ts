import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FacebookConnectModule } from './facebook-connect/facebook-connect.module';
import { WebhookModule } from './webhook/webhook.module';
import { InboxModule } from './inbox/inbox.module';
import { GatewayModule } from './gateway/gateway.module';
import { BillingModule } from './billing/billing.module';
import { UsageModule } from './usage/usage.module';
import { RbacModule } from './rbac/rbac.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { HttpModule } from '@nestjs/axios';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    AuthModule,
    UserModule,
    FacebookConnectModule,
    WebhookModule,
    InboxModule,
    GatewayModule,
    BillingModule,
    UsageModule,
    RbacModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
