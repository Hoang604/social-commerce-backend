// src/worker.ts

import { NestFactory } from '@nestjs/core';
import { EventConsumerModule } from './event-consumer/event-consumer.module';

async function bootstrap() {
  const app = await NestFactory.create(EventConsumerModule);
  app.enableShutdownHooks();
  console.log('Event consumer worker started...');
}

bootstrap();
