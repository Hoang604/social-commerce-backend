import { Test, TestingModule } from '@nestjs/testing';
import { SqsService } from './sqs.service';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sqs', () => {
  return {
    SQSClient: jest.fn().mockImplementation(() => {
      return {
        send: mockSend,
      };
    }),
    SendMessageCommand: jest.fn().mockImplementation((input) => {
      return { input };
    }),
    GetQueueUrlCommand: jest.fn().mockImplementation((input) => {
      return { input };
    }),
  };
});

describe('SqsService', () => {
  let service: SqsService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AWS_REGION') return 'us-east-1';
      if (key === 'AWS_ACCESS_KEY_ID') return 'test_key_id';
      if (key === 'AWS_SECRET_ACCESS_KEY') return 'test_secret_key';
      if (key === 'AWS_SQS_QUEUE_NAME') return 'test_queue';
      if (key === 'AWS_SQS_ENDPOINT') return 'http://localhost:4566';
      return null;
    });
    mockSend.mockClear();
    // Mock GetQueueUrlCommand response
    mockSend.mockResolvedValue({ QueueUrl: 'test_queue_url' });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SqsService>(SqsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw an error if AWS configuration is not set', () => {
      mockConfigService.get.mockReturnValue(null);
      expect(() => new SqsService(mockConfigService as any)).toThrow(
        'Missing AWS_SQS_QUEUE_NAME environment variable.'
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a message to SQS', async () => {
      const payload = { entry: [{ id: 'page_id', time: Date.now() }] };

      await service.sendMessage(payload);

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
      const command = mockSend.mock.calls[0][0];
      expect(command.input.QueueUrl).toBe('test_queue_url');
      expect(JSON.parse(command.input.MessageBody)).toEqual(payload);
    });
  });
});
