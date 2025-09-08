import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessorService } from './webhook-processor.service';
import { InboxEventHandlerService } from '../inbox/services/inbox-event-handler.service';
import type { Message } from 'aws-sdk/clients/sqs';

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let inboxEventHandler: jest.Mocked<InboxEventHandlerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        {
          provide: InboxEventHandlerService,
          useValue: {
            handleFacebookEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookProcessorService>(WebhookProcessorService);
    inboxEventHandler = module.get(InboxEventHandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should call inboxEventHandler.handleFacebookEvent with the correct payload', async () => {
      const payload = { entry: [] };
      const message = {
        MessageId: 'test-id',
        Body: JSON.stringify({ payload }),
      } as Message;

      await service.handleMessage(message);

      expect(inboxEventHandler.handleFacebookEvent).toHaveBeenCalledWith(payload);
    });

    it('should throw an error if the message body is empty', async () => {
      const message = { MessageId: 'test-id' } as Message;

      await expect(service.handleMessage(message)).rejects.toThrow('Message body is empty.');
    });
  });
});
