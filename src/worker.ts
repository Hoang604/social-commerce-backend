// src/worker.ts

import { NestFactory } from '@nestjs/core';
// SỬA LỖI: Cập nhật đường dẫn và tên module
import { EventConsumerModule } from './event-consumer/event-consumer.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    EventConsumerModule // SỬA LỖI: Sử dụng module mới
  );
  app.enableShutdownHooks();
  console.log('Event consumer worker started...');
}

bootstrap();
