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
  let repository: jest.Mocked<Repository<Message>>;
  let facebookApiService: jest.Mocked<FacebookApiService>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let entityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          }
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
    repository = module.get(getRepositoryToken(Message));
    facebookApiService = module.get(FacebookApiService);
    encryptionService = module.get(EncryptionService);
    eventEmitter = module.get(EventEmitter2);
    entityManager = module.get(EntityManager);
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
        (entityManager.getRepository(Conversation).findOne as jest.Mock).mockResolvedValue(conversation);
        repository.save.mockImplementation(async (message) => message as any);
        facebookApiService.sendMessage.mockResolvedValue({ message_id: 'fbMessageId' });

        const result = await service.sendReply('userId', 1, 'text');

        expect(result.status).toEqual(MessageStatus.SENT);
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.sending', expect.any(Object));
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.status.updated', expect.any(Object));
    });

    it('should handle send failure', async () => {
        const conversation = new Conversation();
        conversation.connectedPage = { userId: 'userId', encryptedPageAccessToken: 'token' } as any;
        conversation.participant = { facebookUserId: 'fbUserId' } as any;
        (entityManager.getRepository(Conversation).findOne as jest.Mock).mockResolvedValue(conversation);
        repository.save.mockImplementation(async (message) => message as any);
        facebookApiService.sendMessage.mockRejectedValue(new Error('FB error'));

        const result = await service.sendReply('userId', 1, 'text');

        expect(result.status).toEqual(MessageStatus.FAILED);
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.sending', expect.any(Object));
        expect(eventEmitter.emit).toHaveBeenCalledWith('message.status.updated', expect.any(Object));
    });

    it('should throw NotFoundException if conversation not found', async () => {
        (entityManager.getRepository(Conversation).findOne as jest.Mock).mockResolvedValue(null);
        await expect(service.sendReply('userId', 1, 'text')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listByConversation', () => {
    it('should throw NotFoundException if conversation is not found for the user', async () => {
        (entityManager.getRepository(Conversation).findOne as jest.Mock).mockResolvedValue(null);
        await expect(service.listByConversation('userId', 1, {})).rejects.toThrow(NotFoundException);
    });

    it('should return a paginated list of messages', async () => {
        const conversation = { connectedPage: { userId: 'userId' } };
        (entityManager.getRepository(Conversation).findOne as jest.Mock).mockResolvedValue(conversation as any);
        const qb = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        repository.createQueryBuilder.mockReturnValue(qb as any);

        const result = await service.listByConversation('userId', 1, { limit: 10 });

        expect(result.data).toEqual([]);
        expect(qb.getMany).toHaveBeenCalled();
    });
  });
});
