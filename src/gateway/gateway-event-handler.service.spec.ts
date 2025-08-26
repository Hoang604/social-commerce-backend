import { Test, TestingModule } from '@nestjs/testing';
import { GatewayEventHandlerService } from './gateway-event-handler.service';
import { EventsGateway } from './events.gateway';

describe('GatewayEventHandlerService', () => {
  let service: GatewayEventHandlerService;
  let eventsGateway: jest.Mocked<EventsGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayEventHandlerService,
        {
          provide: EventsGateway,
          useValue: {
            sendToUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GatewayEventHandlerService>(GatewayEventHandlerService);
    eventsGateway = module.get(EventsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessageCreatedEvent', () => {
    it('should call sendToUser on the gateway with the correct parameters', () => {
      const payload = { userId: 'userId', message: 'message' as any };
      service.handleMessageCreatedEvent(payload);
      expect(eventsGateway.sendToUser).toHaveBeenCalledWith('userId', 'message:new', 'message');
    });
  });

  describe('handleConversationUpdatedEvent', () => {
    it('should call sendToUser on the gateway with the correct parameters', () => {
      const payload = { userId: 'userId', conversation: 'conversation' as any };
      service.handleConversationUpdatedEvent(payload);
      expect(eventsGateway.sendToUser).toHaveBeenCalledWith('userId', 'conversation:updated', 'conversation');
    });
  });
});
