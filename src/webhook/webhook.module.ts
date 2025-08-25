import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { SqsService } from './sqs.service';

@Module({
  providers: [WebhookService, SqsService],
  controllers: [WebhookController],
})
export class WebhookModule {}
