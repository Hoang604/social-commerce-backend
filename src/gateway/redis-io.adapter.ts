import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger } from '@nestjs/common'; // Import Logger
import path from 'path/win32';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name); // Tạo một logger instance
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    this.logger.log(`Attempting to connect to Redis at ${redisUrl}...`);

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Nếu kết nối thành công, log ra
      this.logger.log('Successfully connected to Redis.');

      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (err) {
      // Nếu có lỗi, log ra và ném lỗi để dừng ứng dụng
      this.logger.error('Failed to connect to Redis:', err);
      // Ném lỗi sẽ ngăn ứng dụng khởi động với một WebSocket server không hoạt động
      throw err;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    this.logger.log(`Configuring CORS for origin: ${frontendUrl}`);
    options = options || ({} as ServerOptions);
    options.path = options.path || '/socket.io';
    this.logger.log(`Socket.IO server listening on path: ${options.path}`);

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    server.adapter(this.adapterConstructor);
    this.logger.log('Socket.IO server created with Redis adapter.');
    return server;
  }
}
