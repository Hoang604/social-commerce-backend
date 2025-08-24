import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, ConversationStatus } from '../entities/conversation.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';

describe('ConversationService', () => {
  let service: ConversationService;
  let repository: Repository<Conversation>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: getRepositoryToken(Conversation),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    repository = module.get<Repository<Conversation>>(getRepositoryToken(Conversation));
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
  });

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      const conversation = new Conversation();
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(conversation);
      jest.spyOn(repository, 'save').mockResolvedValue(conversation);

      const result = await service.updateStatus(1, ConversationStatus.CLOSED);

      expect(result.status).toEqual(ConversationStatus.CLOSED);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);
      await expect(service.updateStatus(1, ConversationStatus.CLOSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark conversation as read', async () => {
      const conversation = new Conversation();
      conversation.unreadCount = 5;
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(conversation);
      jest.spyOn(repository, 'save').mockResolvedValue(conversation);

      const result = await service.markAsRead(1);

      expect(result.unreadCount).toEqual(0);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);
      await expect(service.markAsRead(1)).rejects.toThrow(NotFoundException);
    });
  });
});
