import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message, MessageStatus } from '../entities/message.entity';
import { Repository, EntityManager } from 'typeorm';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Conversation } from '../entities/conversation.entity';
import { NotFoundException } from '@nestjs/common';

describe('MessageService', () => {
  let service: MessageService;
  let repository: Repository<Message>;
  let facebookApiService: FacebookApiService;
  let encryptionService: EncryptionService;
  let eventEmitter: EventEmitter2;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useClass: Repository,
        },
        {
          provide: FacebookApiService,
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: EncryptionService,
          useValue: { decrypt: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: EntityManager,
          useValue: {
            getRepository: jest.fn().mockReturnValue({
              findOne: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    repository = module.get<Repository<Message>>(getRepositoryToken(Message));
    facebookApiService = module.get<FacebookApiService>(FacebookApiService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a message', async () => {
      const messageData = { content: 'test' } as any;
      const manager = { getRepository: jest.fn().mockReturnValue({ create: jest.fn().mockReturnValue(messageData), save: jest.fn().mockResolvedValue(messageData) }) } as any;
      const result = await service.create(messageData, manager);
      expect(result).toEqual(messageData);
    });
  });

  describe('sendReply', () => {
    it('should send a reply successfully', async () => {
        const conversation = new Conversation();
        conversation.connectedPage = { userId: 'userId', encryptedPageAccessToken: 'token' } as any;
        conversation.participant = { facebookUserId: 'fbUserId' } as any;
        jest.spyOn(entityManager.getRepository(Conversation), 'findOne').mockResolvedValue(conversation);
        jest.spyOn(repository, 'save').mockImplementation(async (message) => message as any);
        (facebookApiService.sendMessage as jest.Mock).mockResolvedValue({ message_id: 'fbMessageId' });

        const result = await service.sendReply('userId', 1, 'text');

        expect(result.status).toEqual(MessageStatus.SENT);
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.sending', expect.any(Object));
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.status.updated', expect.any(Object));
    });

    it('should handle send failure', async () => {
        const conversation = new Conversation();
        conversation.connectedPage = { userId: 'userId', encryptedPageAccessToken: 'token' } as any;
        conversation.participant = { facebookUserId: 'fbUserId' } as any;
        jest.spyOn(entityManager.getRepository(Conversation), 'findOne').mockResolvedValue(conversation);
        jest.spyOn(repository, 'save').mockImplementation(async (message) => message as any);
        (facebookApiService.sendMessage as jest.Mock).mockRejectedValue(new Error('FB error'));

        const result = await service.sendReply('userId', 1, 'text');

        expect(result.status).toEqual(MessageStatus.FAILED);
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.sending', expect.any(Object));
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.status.updated', expect.any(Object));
    });

    it('should throw NotFoundException if conversation not found', async () => {
        jest.spyOn(entityManager.getRepository(Conversation), 'findOne').mockResolvedValue(null);
        await expect(service.sendReply('userId', 1, 'text')).rejects.toThrow(NotFoundException);
    });
  });
});
