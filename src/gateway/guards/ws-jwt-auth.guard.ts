import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserService } from '../../user/user.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const authToken = client.handshake.auth?.token;

      if (!authToken) {
        throw new WsException('Unauthorized: No token provided');
      }

      const payload = await this.jwtService.verifyAsync(authToken);

      // Attach user to the socket for later use
      const user = await this.userService.findOneById(payload.sub);
      if (!user) {
        throw new WsException('Unauthorized: User not found');
      }

      // Important: Attach user payload to the client object
      client.data.user = { id: user.id, email: user.email };

      return true;
    } catch (err) {
      this.logger.error(`WebSocket Authentication Error: ${err.message}`);
      // Throwing WsException will emit an 'exception' event to the client
      throw new WsException('Unauthorized: Invalid token');
    }
  }
}
