import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookService } from './webhook.service';
import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;
  let eventEmitter: EventEmitter2;

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
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<WebhookService>(WebhookService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verify', () => {
    it('should return challenge if verification is successful', () => {
      const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'test_token', 'hub.challenge': 'challenge_string' };
      const result = controller.verify(query);
      expect(result).toEqual('challenge_string');
    });

    it('should throw ForbiddenException if verification fails', () => {
      const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong_token', 'hub.challenge': 'challenge_string' };
      expect(() => controller.verify(query)).toThrow(ForbiddenException);
    });
  });

  describe('handleEvent', () => {
    it('should emit event if signature is valid', () => {
      const req = { headers: { 'x-hub-signature-256': 'sha256=test' }, rawBody: Buffer.from('test') } as unknown as Request;
      const body = { entry: [] };
      jest.spyOn(webhookService, 'verifySignature').mockReturnValue(true);

      controller.handleEvent(req, body);

      expect(eventEmitter.emit).toHaveBeenCalledWith('facebook.event.received', body);
    });

    it('should throw ForbiddenException if signature is invalid', () => {
        const req = { headers: { 'x-hub-signature-256': 'sha256=test' }, rawBody: Buffer.from('test') } as unknown as Request;
        const body = { entry: [] };
        jest.spyOn(webhookService, 'verifySignature').mockReturnValue(false);
  
        expect(() => controller.handleEvent(req, body)).toThrow(ForbiddenException);
      });
  });
});