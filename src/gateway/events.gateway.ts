// src/gateway/events.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SqsService } from '../event-producer/sqs.service';
import { ConversationService } from '../inbox/services/conversation.service';
import { VisitorService } from '../inbox/services/visitor.service';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RealtimeSessionService } from '../realtime-session/realtime-session.service';
import { OnEvent } from '@nestjs/event-emitter';
import { type Message } from 'src/inbox/entities/message.entity';

@WebSocketGateway({
  cors: {
    origin: ['https://app.dinhviethoang604.id.vn', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly sqsService: SqsService,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
    @Inject(forwardRef(() => VisitorService))
    private readonly visitorService: VisitorService,
    private readonly realtimeSessionService: RealtimeSessionService
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
        client.emit('conversationHistory', {
          messages: conversation.messages || [],
        });
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
    this.server.to(visitorSocketId).emit('agentReply', message);
  }

  @OnEvent('message.created')
  async handleMessageCreated(message: Message) {
    const conversation = await this.conversationService.findById(
      message.conversationId
    );

    if (conversation && conversation.projectId) {
      const projectId = conversation.projectId;
      const roomName = `project:${projectId}`;

      this.server.to(roomName).emit('newMessage', message);

      this.logger.log(`Emitted 'newMessage' to room: ${roomName}`);
    }
  }
}
