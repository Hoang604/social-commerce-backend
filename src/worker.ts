import { NestFactory } from '@nestjs/core';
import { WebhookProcessorModule } from './webhook-processor/webhook-processor.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    WebhookProcessorModule
  );
  app.enableShutdownHooks(); // Important for graceful shutdown
  console.log('Webhook processor worker started...');
}

bootstrap();
