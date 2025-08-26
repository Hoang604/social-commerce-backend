import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from './events.gateway';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let server: jest.Mocked<Server>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    server = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as unknown as jest.Mocked<Server>;
    gateway.server = server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should disconnect the client if no user data is present', () => {
      const client = { data: {}, disconnect: jest.fn() } as unknown as Socket;
      gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should make the client join a room named after the user ID', () => {
      const client = { data: { user: { id: 'userId' } }, join: jest.fn() } as unknown as Socket;
      gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith('user:userId');
    });
  });

  describe('handleDisconnect', () => {
    it('should log the disconnection', () => {
      const client = { id: 'clientId' } as Socket;
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      gateway.handleDisconnect(client);
      expect(loggerSpy).toHaveBeenCalledWith('Client disconnected: clientId');
    });
  });

  describe('sendToUser', () => {
    it('should emit an event to the correct user room', () => {
      gateway.sendToUser('userId', 'event', 'payload');
      expect(server.to).toHaveBeenCalledWith('user:userId');
      expect(server.emit).toHaveBeenCalledWith('event', 'payload');
    });
  });
});