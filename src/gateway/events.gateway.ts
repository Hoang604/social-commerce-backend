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
import { Logger } from '@nestjs/common';
import { RealtimeSessionService } from '../realtime-session/realtime-session.service';

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly conversationService: ConversationService,
    private readonly visitorService: VisitorService,
    private readonly realtimeSessionService: RealtimeSessionService
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('identify')
  async handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: number; visitorUid: string }
  ): Promise<void> {
    // SỬA LỖI: Sử dụng hàm `findByUid` mới, không cần transaction
    const visitor = await this.visitorService.findByUid(payload.visitorUid);

    await this.realtimeSessionService.setVisitorSession(
      payload.visitorUid,
      client.id
    );

    if (visitor) {
      // Lưu thông tin vào socket để sử dụng sau này
      client.data.visitorId = visitor.id;
      client.data.projectId = payload.projectId;
      client.data.visitorUid = payload.visitorUid;

      // SỬA LỖI: Sử dụng hàm `getHistoryByVisitorId` mới
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
      // Nếu visitor chưa tồn tại, chỉ lưu thông tin tạm thời.
      // Visitor sẽ được tạo ra trong EventConsumer khi có tin nhắn đầu tiên.
      client.data.projectId = payload.projectId;
      client.data.visitorUid = payload.visitorUid;
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { content: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    // Đảm bảo client đã identify trước khi gửi tin nhắn
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

  @SubscribeMessage('visitorTyping')
  handleVisitorTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { isTyping: boolean }
  ): void {
    const { projectId, conversationId } = client.data;
    if (projectId) {
      // Phát sự kiện này tới các nhân viên hỗ trợ
      this.server.to(`project:${projectId}`).emit('agentTyping', {
        conversationId,
        isTyping: payload.isTyping,
      });
    }
  }

  public sendReplyToVisitor(visitorSocketId: string, message: any) {
    // Thống nhất tên sự kiện là 'agentReply' (camelCase)
    this.server.to(visitorSocketId).emit('agentReply', message);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (client.data.visitorUid) {
      this.realtimeSessionService.deleteVisitorSession(client.data.visitorUid);
    }
  }
}
