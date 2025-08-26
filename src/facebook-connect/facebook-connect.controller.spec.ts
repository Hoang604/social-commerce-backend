import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectController } from './facebook-connect.controller';
import { FacebookConnectService } from './facebook-connect.service';
import { HttpStatus } from '@nestjs/common';

describe('FacebookConnectController', () => {
  let controller: FacebookConnectController;
  let service: jest.Mocked<FacebookConnectService>;

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
            getFrontendSelectPageUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FacebookConnectController>(
      FacebookConnectController
    );
    service = module.get(FacebookConnectService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateConnection', () => {
    it('should return the authorization URL', () => {
      const authUrl = 'http://auth.url';
      service.initiateConnection.mockReturnValue(authUrl);
      const req = { user: { id: 'userId' } };

      const result = controller.initiateConnection(req as any);

      expect(result).toEqual({ authUrl });
      expect(service.initiateConnection).toHaveBeenCalledWith('userId');
    });
  });

  describe('handleCallback', () => {
    it('should call handleCallback on the service and redirect to the frontend', async () => {
      const req = { user: { id: 'userId' } };
      const res = { redirect: jest.fn() };
      const query = { code: 'code', state: 'state' };
      const frontendUrl = 'http://frontend.url';
      service.getFrontendSelectPageUrl.mockReturnValue(frontendUrl);

      await controller.handleCallback(query, req as any, res as any);

      expect(service.handleCallback).toHaveBeenCalledWith('userId', 'code', 'state');
      expect(res.redirect).toHaveBeenCalledWith(frontendUrl);
    });
  });

  describe('getPendingPages', () => {
    it('should return the pending pages', () => {
      const pendingPages = { pages: [] };
      service.getPendingPages.mockReturnValue(pendingPages);
      const req = { user: { id: 'userId' } };

      const result = controller.getPendingPages(req as any);

      expect(result).toEqual(pendingPages);
      expect(service.getPendingPages).toHaveBeenCalledWith('userId');
    });
  });

  describe('connectPages', () => {
    it('should return 201 if all succeed', async () => {
        const resultData = { succeeded: ['page1'], failed: [] };
        service.connectPages.mockResolvedValue(resultData as any);
        const res = { status: jest.fn().mockReturnThis() };

        const result = await controller.connectPages({ user: { id: 'userId' } } as any, res as any, { pages: [] });

        expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
        expect(result).toEqual(resultData);
    });

    it('should return 207 if some fail', async () => {
        const resultData = { succeeded: ['page1'], failed: ['page2'] };
        service.connectPages.mockResolvedValue(resultData as any);
        const res = { status: jest.fn().mockReturnThis() };

        const result = await controller.connectPages({ user: { id: 'userId' } } as any, res as any, { pages: [] });

        expect(res.status).toHaveBeenCalledWith(HttpStatus.MULTI_STATUS);
        expect(result).toEqual(resultData);
    });

    it('should return 400 if all fail', async () => {
        const resultData = { succeeded: [], failed: ['page2'] };
        service.connectPages.mockResolvedValue(resultData as any);
        const res = { status: jest.fn().mockReturnThis() };

        const result = await controller.connectPages({ user: { id: 'userId' } } as any, res as any, { pages: [] });

        expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(result).toEqual(resultData);
    });
  });

  describe('listConnectedPages', () => {
    it('should return the list of connected pages', async () => {
        const pages = ['page1'];
        service.listConnectedPages.mockResolvedValue(pages as any);

        const result = await controller.listConnectedPages({ user: { id: 'userId' } } as any);

        expect(result).toEqual(pages);
        expect(service.listConnectedPages).toHaveBeenCalledWith('userId');
    });
  });

  describe('disconnectPage', () => {
    it('should call disconnectPage on the service', async () => {
        await controller.disconnectPage({ user: { id: 'userId' } } as any, 'pageId');
        expect(service.disconnectPage).toHaveBeenCalledWith('userId', 'pageId');
    });
  });
});
