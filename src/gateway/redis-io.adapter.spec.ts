import { Test, TestingModule } from '@nestjs/testing';
import { RedisIoAdapter } from './redis-io.adapter';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { IoAdapter } from '@nestjs/platform-socket.io';

jest.mock('@socket.io/redis-adapter');
jest.mock('redis');

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisIoAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        { provide: 'INestApplication', useValue: {get: jest.fn()} }
      ],
    }).compile();

    adapter = new RedisIoAdapter(module.get('INestApplication'), new ConfigService());
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('connectToRedis', () => {
    it('should create pub and sub clients and connect to them', async () => {
      const pubClient = { connect: jest.fn(), duplicate: jest.fn() };
      const subClient = { connect: jest.fn() };
      pubClient.duplicate.mockReturnValue(subClient);
      (createClient as jest.Mock).mockReturnValue(pubClient);

      await adapter.connectToRedis();

      expect(createClient).toHaveBeenCalled();
      expect(pubClient.connect).toHaveBeenCalled();
      expect(subClient.connect).toHaveBeenCalled();
      expect(createAdapter).toHaveBeenCalledWith(pubClient, subClient);
    });
  });

  describe('createIOServer', () => {
    it('should create a server with the redis adapter', async () => {
      const server = { adapter: jest.fn() };
      const createIOServerSpy = jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server as any);
      
      await adapter.connectToRedis(); // Make sure adapterConstructor is set
      adapter.createIOServer(3000);

      expect(createIOServerSpy).toHaveBeenCalled();
      expect(server.adapter).toHaveBeenCalledWith(adapter['adapterConstructor']);
    });
  });
});