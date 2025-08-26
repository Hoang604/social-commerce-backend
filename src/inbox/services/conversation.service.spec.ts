import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, ConversationStatus } from '../entities/conversation.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';

describe('ConversationService', () => {
  let service: ConversationService;
  let repository: jest.Mocked<Repository<Conversation>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            increment: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
            findOneBy: jest.fn(),
          }
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    repository = module.get(getRepositoryToken(Conversation));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateByFacebookIds', () => {
    it('should find and return existing conversation', async () => {
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn().mockResolvedValueOnce({ id: 1 } as ConnectedPage)
                               .mockResolvedValueOnce({ id: 1 } as Conversation),
                create: jest.fn(),
                save: jest.fn(),
            }),
        } as any;

        const result = await service.findOrCreateByFacebookIds('fbPageId', 1, 'fbConvId', manager);
        expect(result).toEqual({ id: 1 });
    });

    it('should create and return new conversation if not found', async () => {
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn().mockResolvedValueOnce({ id: 1 } as ConnectedPage)
                               .mockResolvedValueOnce(null),
                create: jest.fn().mockReturnValue({ id: 2 } as Conversation),
                save: jest.fn(),
            }),
        } as any;

        const result = await service.findOrCreateByFacebookIds('fbPageId', 1, 'fbConvId', manager);
        expect(result).toEqual({ id: 2 });
    });

    it('should throw NotFoundException if page is not found', async () => {
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn().mockResolvedValueOnce(null),
            }),
        } as any;

        await expect(service.findOrCreateByFacebookIds('fbPageId', 1, 'fbConvId', manager)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMetadata', () => {
    it('should increment unreadCount and update last message details', async () => {
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                increment: jest.fn(),
                update: jest.fn(),
            }),
        } as any;
        const lastMessage = { content: 'test', createdAtFacebook: new Date() } as any;

        await service.updateMetadata(1, lastMessage, 1, manager);

        expect(manager.getRepository().increment).toHaveBeenCalledWith({ id: 1 }, 'unreadCount', 1);
        expect(manager.getRepository().update).toHaveBeenCalledWith({ id: 1 }, expect.any(Object));
    });
  });

  describe('listByPage', () => {
    it('should return a paginated list of conversations for a user and page', async () => {
        const qb = {
            leftJoin: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        };
        repository.createQueryBuilder.mockReturnValue(qb as any);

        await service.listByPage('userId', { connectedPageId: 1, page: 1, limit: 10 });

        expect(qb.getManyAndCount).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      const conversation = new Conversation();
      repository.findOneBy.mockResolvedValue(conversation);
      repository.save.mockResolvedValue(conversation);

      const result = await service.updateStatus(1, ConversationStatus.CLOSED);

      expect(result.status).toEqual(ConversationStatus.CLOSED);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.updateStatus(1, ConversationStatus.CLOSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark conversation as read', async () => {
      const conversation = new Conversation();
      conversation.unreadCount = 5;
      repository.findOneBy.mockResolvedValue(conversation);
      repository.save.mockResolvedValue(conversation);

      const result = await service.markAsRead(1);

      expect(result.unreadCount).toEqual(0);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.markAsRead(1)).rejects.toThrow(NotFoundException);
    });
  });
});
