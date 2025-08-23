import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectService } from './facebook-connect.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EncryptionService } from '../common/services/encryption.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConnectedPage } from './entities/connected-page.entity';

describe('FacebookConnectService', () => {
  let service: FacebookConnectService;

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
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConnectedPage),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FacebookConnectService>(FacebookConnectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
