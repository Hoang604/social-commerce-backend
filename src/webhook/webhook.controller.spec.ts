import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { SqsService } from './sqs.service';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;
  let sqsService: SqsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_token'),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            verifySignature: jest.fn(),
          },
        },
        {
          provide: SqsService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<WebhookService>(WebhookService);
    sqsService = module.get<SqsService>(SqsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verify', () => {
    it('should return challenge if verification is successful', () => {
      const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'test_token', 'hub.challenge': 'challenge_string' };
      const result = controller.verify(query as any);
      expect(result).toEqual('challenge_string');
    });

    it('should throw ForbiddenException if verification fails', () => {
      const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong_token', 'hub.challenge': 'challenge_string' };
      expect(() => controller.verify(query as any)).toThrow(ForbiddenException);
    });
  });

  describe('handleEvent', () => {
    it('should call sqsService.sendMessage if signature is valid', async () => {
      const req = { headers: { 'x-hub-signature-256': 'sha256=test' }, rawBody: Buffer.from('test') } as unknown as Request;
      const body = { entry: [] };
      jest.spyOn(webhookService, 'verifySignature').mockReturnValue(true);

      await controller.handleEvent(req, body);

      expect(sqsService.sendMessage).toHaveBeenCalledWith(body, 'sha256=test');
    });

    it('should throw ForbiddenException if signature is invalid', async () => {
        const req = { headers: { 'x-hub-signature-256': 'sha256=test' }, rawBody: Buffer.from('test') } as unknown as Request;
        const body = { entry: [] };
        jest.spyOn(webhookService, 'verifySignature').mockReturnValue(false);
  
        await expect(controller.handleEvent(req, body)).rejects.toThrow(ForbiddenException);
      });

    it('should throw ForbiddenException if rawBody is missing', async () => {
        const req = { headers: { 'x-hub-signature-256': 'sha256=test' } } as unknown as Request;
        const body = { entry: [] };
        jest.spyOn(webhookService, 'verifySignature').mockReturnValue(true);
  
        await expect(controller.handleEvent(req, body)).rejects.toThrow(ForbiddenException);
    });

    it('should throw InternalServerErrorException if sqsService.sendMessage fails', async () => {
        const req = { headers: { 'x-hub-signature-256': 'sha256=test' }, rawBody: Buffer.from('test') } as unknown as Request;
        const body = { entry: [] };
        jest.spyOn(webhookService, 'verifySignature').mockReturnValue(true);
        (sqsService.sendMessage as jest.Mock).mockRejectedValue(new Error());

        await expect(controller.handleEvent(req, body)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
