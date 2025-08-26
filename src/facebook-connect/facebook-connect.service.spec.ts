import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectService } from './facebook-connect.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EncryptionService } from '../common/services/encryption.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConnectedPage } from './entities/connected-page.entity';
import { of, throwError } from 'rxjs';
import { ForbiddenException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

describe('FacebookConnectService', () => {
  let service: FacebookConnectService;
  let httpService: jest.Mocked<HttpService>;
  let pageRepository: jest.Mocked<any>;
  let entityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookConnectService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FACEBOOK_APP_ID') return 'test_app_id';
              if (key === 'FACEBOOK_APP_SECRET') return 'test_app_secret';
              if (key === 'FACEBOOK_CALLBACK_URL') return 'http://localhost/callback';
              if (key === 'FRONTEND_SELECT_PAGE_URL') return 'http://localhost/select-page';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn().mockReturnValue('encrypted_token'),
            decrypt: jest.fn().mockReturnValue('decrypted_token'),
          },
        },
        {
          provide: getRepositoryToken(ConnectedPage),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
            provide: EntityManager,
            useValue: {
                transaction: jest.fn().mockImplementation(async (cb) => cb({ create: jest.fn(), save: jest.fn() })),
            }
        }
      ],
    }).compile();

    service = module.get<FacebookConnectService>(FacebookConnectService);
    httpService = module.get(HttpService);
    pageRepository = module.get(getRepositoryToken(ConnectedPage));
    entityManager = module.get(EntityManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateConnection', () => {
    it('should generate a state and return the authorization URL', () => {
        const url = service.initiateConnection('userId');
        expect(url).toContain('https://www.facebook.com');
    });
  });

  describe('handleCallback', () => {
    it('should throw ForbiddenException if state is invalid', async () => {
        await expect(service.handleCallback('userId', 'code', 'invalid_state')).rejects.toThrow(ForbiddenException);
    });

    it('should store pending connection on success', async () => {
        const state = service.initiateConnection('userId').split('state=')[1].split('&')[0];
        httpService.get.mockReturnValueOnce(of({ data: { access_token: 'user_token' } })); // exchange code
        httpService.get.mockReturnValueOnce(of({ data: { data: [{id: 'page1', name: 'Page 1'}] } })); // get pages

        await service.handleCallback('userId', 'code', state);
        expect(service.getPendingPages('userId')).toBeDefined();
    });
  });

  describe('getPendingPages', () => {
    it('should throw NotFoundException if no pending connection is found', () => {
        expect(() => service.getPendingPages('userId')).toThrow(NotFoundException);
    });
  });

  describe('connectPages', () => {
    it('should throw BadRequestException if pending connection has expired', async () => {
        await expect(service.connectPages('userId', { pages: [] })).rejects.toThrow(BadRequestException);
    });
  });

  describe('listConnectedPages', () => {
    it('should return the list of connected pages for a user', async () => {
        pageRepository.find.mockResolvedValue(['page1']);
        const pages = await service.listConnectedPages('userId');
        expect(pages).toEqual(['page1']);
    });
  });

  describe('disconnectPage', () => {
    it('should throw NotFoundException if page is not found', async () => {
        pageRepository.findOne.mockResolvedValue(null);
        await expect(service.disconnectPage('userId', 'pageId')).rejects.toThrow(NotFoundException);
    });

    it('should unsubscribe from webhooks and delete the page', async () => {
        const page = { id: 'pageId', facebookPageId: 'fbPageId', encryptedPageAccessToken: 'token' };
        pageRepository.findOne.mockResolvedValue(page);
        httpService.delete.mockReturnValue(of({}));

        await service.disconnectPage('userId', 'pageId');
        expect(pageRepository.delete).toHaveBeenCalledWith({ id: 'pageId', userId: 'userId' });
    });
  });
});
