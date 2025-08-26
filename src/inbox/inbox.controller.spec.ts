import { Test, TestingModule } from '@nestjs/testing';
import { InboxController } from './inbox.controller';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('InboxController', () => {
  let controller: InboxController;
  let conversationService: ConversationService;
  let messageService: MessageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [
        {
          provide: ConversationService,
          useValue: {
            listByPage: jest.fn(),
            updateStatus: jest.fn(),
            markAsRead: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            sendReply: jest.fn(),
            listByConversation: jest.fn(),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<InboxController>(InboxController);
    conversationService = module.get<ConversationService>(ConversationService);
    messageService = module.get<MessageService>(MessageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listConversations', () => {
    it('should call conversationService.listByPage', async () => {
      const req = { user: { id: 'userId' } };
      const query = { connectedPageId: 1, status: 'OPEN', page: 1, limit: 10 };
      await controller.listConversations(req as any, query);
      expect(conversationService.listByPage).toHaveBeenCalledWith('userId', query);
    });
  });

  describe('sendReply', () => {
    it('should call messageService.sendReply', async () => {
      const req = { user: { id: 'userId' } };
      const body = { text: 'Hello' };
      await controller.sendReply(req as any, 1, body);
      expect(messageService.sendReply).toHaveBeenCalledWith('userId', 1, 'Hello');
    });
  });

  describe('updateConversation', () => {
    it('should call conversationService.updateStatus', async () => {
      const body = { status: 'CLOSED' as any };
      await controller.updateConversation(1, body);
      expect(conversationService.updateStatus).toHaveBeenCalledWith(1, 'CLOSED');
    });

    it('should call conversationService.markAsRead', async () => {
      const body = { read: true };
      await controller.updateConversation(1, body);
      expect(conversationService.markAsRead).toHaveBeenCalledWith(1);
    });
  });

  describe('listMessages', () => {
    it('should call messageService.listByConversation', async () => {
      const req = { user: { id: 'userId' } };
      const query = { page: 1, limit: 10 };
      await controller.listMessages(req as any, 1, query);
      expect(messageService.listByConversation).toHaveBeenCalledWith('userId', 1, query);
    });
  });
});
