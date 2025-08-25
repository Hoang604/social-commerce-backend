import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';

@WebSocketGateway()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  @UseGuards(WsJwtAuthGuard)
  handleConnection(client: Socket, ...args: any[]) {
    const userId = client.data.user?.id;
    if (!userId) {
      this.logger.warn(`Client connected without user data. Disconnecting.`);
      client.disconnect(true);
      return;
    }

    // Each user joins a room named after their own ID.
    // This ensures that we can emit events specifically to a single user.
    const roomName = `user:${userId}`;
    client.join(roomName);

    this.logger.log(
      `Client connected: ${client.id}, User ID: ${userId}, Joined room: ${roomName}`
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emits an event to a specific user's room.
   * @param userId The ID of the user to send the event to.
   * @param event The event name (e.g., 'message:new').
   * @param payload The data to send with the event.
   */
  sendToUser(userId: string, event: string, payload: any) {
    const roomName = `user:${userId}`;
    this.logger.log(`Emitting event '${event}' to room '${roomName}'`);
    this.server.to(roomName).emit(event, payload);
  }
}
