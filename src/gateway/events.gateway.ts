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
import { Logger, Inject } from '@nestjs/common';
import { RealtimeSessionService } from '../realtime-session/realtime-session.service';
import { type Redis } from 'ioredis';
import { REDIS_SUBSCRIBER_CLIENT } from 'src/redis/redis.module';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  VisitorIdentifiedEvent,
  VisitorMessageReceivedEvent,
} from '../inbox/events';
import { Conversation } from 'src/inbox/entities/conversation.entity';

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
    private readonly realtimeSessionService: RealtimeSessionService,
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly redisSubscriber: Redis,
    private readonly eventEmitter: EventEmitter2
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

  afterInit(server: Server) {
    this.logger.log('Gateway Initialized. Subscribing to Redis channel...');
    this.redisSubscriber.subscribe(NEW_MESSAGE_CHANNEL, (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to Redis channel', err);
      } else {
        this.logger.log(`Subscribed successfully to "${NEW_MESSAGE_CHANNEL}"`);
      }
    });

    this.redisSubscriber.on('message', (channel, message) => {
      this.logger.log(`Received message on channel: ${channel}`);
      if (channel === NEW_MESSAGE_CHANNEL) {
        this.eventEmitter.emit('redis.message.received', message);
      }
    });
  }

  public prepareSocketForVisitor(
    socketId: string,
    visitor: import('src/inbox/entities/visitor.entity').Visitor | null,
    conversation: Conversation | null,
    projectId: number,
    visitorUid: string
  ) {
    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      this.logger.warn(`Could not find socket with id: ${socketId}`);
      return;
    }

    socket.data.projectId = projectId;
    socket.data.visitorUid = visitorUid;

    if (visitor) {
      socket.data.visitorId = visitor.id;
    }

    if (conversation) {
      const messagesForFrontend: MessageFrontend[] = conversation.messages.map(
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

      socket.emit('conversationHistory', {
        messages: messagesForFrontend,
      });
      if (visitor)
        this.logger.log(
          `Loaded conversation history for visitor ${visitor.id} in project ${projectId} successfully.`
        );
      socket.data.conversationId = conversation.id;
    }
  }

  @SubscribeMessage('identify')
  async handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: number; visitorUid: string }
  ): Promise<void> {
    this.logger.debug(
      `Identify event from client ${client.id} for visitorUid: ${payload.visitorUid} in projectId: ${payload.projectId}`
    );

    const event = new VisitorIdentifiedEvent();
    event.projectId = payload.projectId;
    event.visitorUid = payload.visitorUid;
    event.socketId = client.id;
    this.eventEmitter.emit('visitor.identified', event);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { content: string; tempId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    if (!client.data.visitorUid || !client.data.projectId) {
      return;
    }

    const event = new VisitorMessageReceivedEvent();
    event.tempId = data.tempId;
    event.content = data.content;
    event.visitorUid = client.data.visitorUid;
    event.projectId = client.data.projectId;
    event.socketId = client.id;
    this.eventEmitter.emit('visitor.message.received', event);
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

  @SubscribeMessage('joinProjectRoom')
  handleJoinProjectRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: number }
  ): { status: string; roomName: string } {
    const roomName = `project:${payload.projectId}`;
    client.join(roomName);
    this.logger.log(`Client with ${client.id} joined room: ${roomName}`);
    return { status: 'ok', roomName };
  }

  @SubscribeMessage('leaveProjectRoom')
  handleLeaveProjectRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: number }
  ): { status: string; roomName: string } {
    const roomName = `project:${payload.projectId}`;
    client.leave(roomName);
    this.logger.log(`Client with ${client.id} left room: ${roomName}`);
    return { status: 'ok', roomName };
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

  public visitorMessageSent(visitorSocketId: string, data: any) {
    try {
      this.server.to(visitorSocketId).emit('messageSent', data);
    } catch (error) {
      this.logger.log(error);
    }
  }
}
