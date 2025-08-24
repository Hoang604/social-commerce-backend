import { Test, TestingModule } from '@nestjs/testing';
import { InboxEventHandlerService } from './inbox-event-handler.service';
import { ParticipantService } from './participant.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { EntityManager } from 'typeorm';

describe('InboxEventHandlerService', () => {
  let service: InboxEventHandlerService;
  let participantService: ParticipantService;
  let conversationService: ConversationService;
  let messageService: MessageService;
  let facebookApiService: FacebookApiService;
  let encryptionService: EncryptionService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxEventHandlerService,
        {
          provide: ParticipantService,
          useValue: { upsert: jest.fn() },
        },
        {
          provide: ConversationService,
          useValue: { findOrCreateByFacebookIds: jest.fn(), updateMetadata: jest.fn() },
        },
        {
          provide: MessageService,
          useValue: { create: jest.fn() },
        },
        {
          provide: FacebookApiService,
          useValue: { getUserProfile: jest.fn() },
        },
        {
          provide: EncryptionService,
          useValue: { decrypt: jest.fn() },
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest.fn().mockImplementation(async (cb) => cb(entityManager)),
            getRepository: jest.fn().mockReturnValue({
                findOneBy: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InboxEventHandlerService>(InboxEventHandlerService);
    participantService = module.get<ParticipantService>(ParticipantService);
    conversationService = module.get<ConversationService>(ConversationService);
    messageService = module.get<MessageService>(MessageService);
    facebookApiService = module.get<FacebookApiService>(FacebookApiService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleFacebookEvent', () => {
    it('should handle new message event', async () => {
        const payload = {
            entry: [
                {
                    messaging: [
                        {
                            message: { mid: 'm_123', text: 'Hello' },
                            sender: { id: 'sender_id' },
                            recipient: { id: 'recipient_id' },
                            timestamp: Date.now(),
                        },
                    ],
                },
            ],
        };

        (entityManager.getRepository().findOneBy as jest.Mock).mockResolvedValue({ encryptedPageAccessToken: 'token' });
        (encryptionService.decrypt as jest.Mock).mockReturnValue('decrypted_token');
        (facebookApiService.getUserProfile as jest.Mock).mockResolvedValue({ name: 'Test User', profile_pic: '' });
        (participantService.upsert as jest.Mock).mockResolvedValue({ id: 1 } as any);
        (conversationService.findOrCreateByFacebookIds as jest.Mock).mockResolvedValue({ id: 1 } as any);
        (messageService.create as jest.Mock).mockResolvedValue({ facebookMessageId: 'm_123' } as any);

        await service.handleFacebookEvent(payload);

        expect(conversationService.updateMetadata).toHaveBeenCalled();
    });
  });
});
