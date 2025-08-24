import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectController } from './facebook-connect.controller';
import { FacebookConnectService } from './facebook-connect.service';
import { EntityManager } from 'typeorm';

describe('FacebookConnectController', () => {
  let controller: FacebookConnectController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacebookConnectController],
      providers: [
        {
          provide: FacebookConnectService,
          useValue: {
            initiateConnection: jest.fn(),
            handleCallback: jest.fn(),
            getPendingPages: jest.fn(),
            connectPages: jest.fn(),
            listConnectedPages: jest.fn(),
            disconnectPage: jest.fn(),
          },
        },
        // Mock EntityManager if it's a direct dependency of the controller,
        // but it's in the service, so mocking the service is sufficient.
      ],
    }).compile();

    controller = module.get<FacebookConnectController>(
      FacebookConnectController
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
