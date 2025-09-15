import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger } from '@nestjs/common';
import { ProjectService } from '../projects/project.service';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(
    private readonly app: INestApplication,
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
      this.logger.log('Successfully connected to Redis.');
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (err) {
      this.logger.error('Failed to connect to Redis:', err);
      throw err;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    server.adapter(this.adapterConstructor);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const projectService = this.app.get(ProjectService);
    const logger = this.logger;

    server.use(async (socket, next) => {
      const origin = socket.handshake.headers.origin;
      if (!origin) {
        return next();
      }

      if (origin === frontendUrl) {
        logger.log(`Allowing origin (frontend): ${origin}`);
        return next();
      }

      const projectId = socket.handshake.query.projectId;

      if (!projectId || typeof projectId !== 'string') {
        logger.warn(`Origin ${origin} without projectId blocked.`);
        return next(new Error('Project ID is missing or invalid.'));
      }

      const project = await projectService.findByProjectId(+projectId);

      if (
        project &&
        project.whitelistedDomains &&
        project.whitelistedDomains.includes(origin)
      ) {
        logger.log(`Allowing origin (widget): ${origin}`);
        return next();
      }

      logger.warn(`Origin ${origin} not in whitelist. Blocked.`);
      return next(new Error('Not allowed by CORS'));
    });

    this.logger.log(
      'Socket.IO server created with Redis adapter and CORS middleware.'
    );
    return server;
  }
}
