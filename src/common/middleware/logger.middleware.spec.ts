import { Test, TestingModule } from '@nestjs/testing';
import { LoggerMiddleware } from './logger.middleware';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerMiddleware,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<LoggerMiddleware>(LoggerMiddleware);
    logger = module.get(Logger);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should log the request and response details on finish', () => {
    const req = { method: 'GET', originalUrl: '/', get: jest.fn().mockReturnValue('test-agent') } as unknown as Request;
    const res = { on: jest.fn(), get: jest.fn().mockReturnValue('123'), statusCode: 200 } as unknown as Response;
    const next = jest.fn();

    // Manually set the logger instance
    (middleware as any).logger = logger;

    middleware.use(req, res, next);

    // Simulate the finish event
    const finishCallback = (res.on as jest.Mock).mock.calls[0][1];
    finishCallback();

    expect(logger.log).toHaveBeenCalledWith('GET / 200 123 - test-agent');
    expect(next).toHaveBeenCalled();
  });
});
