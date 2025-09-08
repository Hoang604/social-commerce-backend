// src/gateway/events.gateway.ts

import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SqsService } from '../event-producer/sqs.service';

@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  // SỬA LỖI: Không cần inject ConfigService ở đây nữa
  constructor(private readonly sqsService: SqsService) {}

  @SubscribeMessage('newMessageFromVisitor')
  async handleNewMessage(
    @MessageBody()
    data: { visitorUid: string; projectId: number; text: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const eventPayload = {
      type: 'NEW_MESSAGE_FROM_VISITOR',
      payload: {
        ...data,
        socketId: client.id,
      },
      timestamp: new Date().toISOString(),
    };

    // SỬA LỖI: Lệnh gọi đã được đơn giản hóa
    await this.sqsService.sendMessage(eventPayload);

    client.emit('message_received_ack');
  }

  sendReplyToVisitor(visitorSocketId: string, message: any) {
    this.server.to(visitorSocketId).emit('agent_reply', message);
  }
}
