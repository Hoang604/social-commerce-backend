import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventsGateway } from './events.gateway';
import { Message } from '../inbox/entities/message.entity';

@Injectable()
export class GatewayEventHandlerService {
  private readonly logger = new Logger(GatewayEventHandlerService.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  @OnEvent('message.created')
  handleMessageCreatedEvent(payload: { userId: string; message: Message }) {
    this.logger.log(
      `Handling 'message.created' event for user ${payload.userId}`
    );
    this.eventsGateway.sendToUser(
      payload.userId,
      'message:new',
      payload.message
    );
  }

  @OnEvent('conversation.updated')
  handleConversationUpdatedEvent(payload: {
    userId: string;
    conversation: any;
  }) {
    this.logger.log(
      `Handling 'conversation.updated' event for user ${payload.userId}`
    );
    this.eventsGateway.sendToUser(
      payload.userId,
      'conversation:updated',
      payload.conversation
    );
  }

  // Add more event handlers here for other business events...
}
