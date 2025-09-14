// src/worker.ts

import { NestFactory } from '@nestjs/core';
import { EventConsumerModule } from './event-consumer/event-consumer.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(EventConsumerModule);

  const logger = app.get(Logger);
  logger.log('Event consumer worker is initializing...');

  logger.log('Event consumer worker is running.');

  await new Promise(() => {});
}

bootstrap();
