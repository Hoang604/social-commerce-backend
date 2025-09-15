// src/gateway/events.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SqsService } from '../event-producer/sqs.service';
import { ConversationService } from '../inbox/services/conversation.service';
import { VisitorService } from '../inbox/services/visitor.service';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RealtimeSessionService } from '../realtime-session/realtime-session.service';
import { type Message } from 'src/inbox/entities/message.entity';
import { type Redis } from 'ioredis';
import { REDIS_SUBSCRIBER_CLIENT } from 'src/redis/redis.module';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

const NEW_MESSAGE_CHANNEL = 'new_message_channel';

type MessageStatus = 'sending' | 'sent' | 'failed';

type MessageSender = {
  type: 'visitor' | 'agent';
  name?: string;
};

type MessageFrontend = {
  id: string | number;
  content: string;
  sender: MessageSender;
  status: MessageStatus;
  timestamp: string;
};

@UseGuards(WsJwtAuthGuard)
@WebSocketGateway()
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly sqsService: SqsService,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
    @Inject(forwardRef(() => VisitorService))
    private readonly visitorService: VisitorService,
    private readonly realtimeSessionService: RealtimeSessionService,
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly redisSubscriber: Redis
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (client.data.visitorUid) {
      this.realtimeSessionService.deleteVisitorSession(client.data.visitorUid);
    }
  }

  afterInit() {
    this.logger.log('Gateway Initialized. Subscribing to Redis channel...');
    this.redisSubscriber.subscribe(NEW_MESSAGE_CHANNEL, (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to Redis channel', err);
      } else {
        this.logger.log(`Subscribed successfully to "${NEW_MESSAGE_CHANNEL}"`);
      }
    });

    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === NEW_MESSAGE_CHANNEL) {
        this.handleNewMessage(message);
      }
    });
  }

  @SubscribeMessage('identify')
  async handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: number; visitorUid: string }
  ): Promise<void> {
    const visitor = await this.visitorService.findByUid(payload.visitorUid);

    await this.realtimeSessionService.setVisitorSession(
      payload.visitorUid,
      client.id
    );

    if (visitor) {
      client.data.visitorId = visitor.id;
      client.data.projectId = payload.projectId;
      client.data.visitorUid = payload.visitorUid;

      const conversation = await this.conversationService.getHistoryByVisitorId(
        visitor.id
      );

      if (conversation) {
        let messagesForFrontend: MessageFrontend[] = conversation.messages.map(
          (msg) => ({
            id: msg.id,
            content: msg.content || '',
            sender: {
              type: msg.fromCustomer ? 'visitor' : 'agent',
              name: msg.senderId,
            },
            status: msg.status as MessageStatus,
            timestamp: msg.createdAt.toISOString(),
          })
        );

        client.emit('conversationHistory', {
          messages: messagesForFrontend,
        });
        this.logger.log(
          `Loaded conversation history for visitor ${visitor.id} in project ${payload.projectId}`
        );
        // this.logger.debug(
        //   `Conversation messages: ${JSON.stringify(messagesForFrontend)}`
        // );
        client.data.conversationId = conversation.id;
      }
    } else {
      client.data.projectId = payload.projectId;
      client.data.visitorUid = payload.visitorUid;
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { content: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    if (!client.data.visitorUid || !client.data.projectId) {
      return;
    }

    const eventPayload = {
      type: 'NEW_MESSAGE_FROM_VISITOR',
      payload: {
        content: data.content,
        visitorUid: client.data.visitorUid,
        projectId: client.data.projectId,
        socketId: client.id,
      },
      timestamp: new Date().toISOString(),
    };

    await this.sqsService.sendMessage(eventPayload);
  }

  @SubscribeMessage('visitorIsTyping')
  handleVisitorTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { isTyping: boolean }
  ): void {
    const { projectId, conversationId } = client.data;
    if (projectId) {
      this.server.to(`project:${projectId}`).emit('visitorIsTyping', {
        conversationId,
        isTyping: payload.isTyping,
      });
    }
  }

  @SubscribeMessage('updateContext')
  handleUpdateContext(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { currentUrl: string }
  ): void {
    const { projectId, conversationId } = client.data;
    if (!projectId || !conversationId) {
      return;
    }

    this.server.to(`project:${projectId}`).emit('visitorContextUpdated', {
      conversationId,
      currentUrl: payload.currentUrl,
    });
  }

  public sendAgentTypingToVisitor(
    visitorSocketId: string,
    isTyping: boolean,
    agentName: string
  ) {
    this.server.to(visitorSocketId).emit('agentIsTyping', {
      agentName,
      isTyping,
    });
  }

  public sendReplyToVisitor(visitorSocketId: string, message: any) {
    this.server.to(visitorSocketId).emit('agentReplied', message);
  }

  private async handleNewMessage(messageString: string) {
    try {
      const message: Message = JSON.parse(messageString);
      this.logger.log(
        `Received new message from Redis channel: Message ID ${message.id}`
      );

      const conversation = await this.conversationService.findById(
        message.conversationId
      );

      if (conversation && conversation.projectId) {
        const projectId = conversation.projectId;
        const roomName = `project:${projectId}`;

        this.server.to(roomName).emit('newMessage', message);

        this.logger.log(`Emitted 'newMessage' to room: ${roomName}`);
      }
    } catch (error) {
      this.logger.error('Error processing message from Redis:', error);
    }
  }
}
