import { Test, TestingModule } from '@nestjs/testing';
import { RawBodyMiddleware } from './raw-body.middleware';
import { Request, Response } from 'express';
import { raw } from 'body-parser';

jest.mock('body-parser', () => ({
    raw: jest.fn(() => (req, res, next) => next()),
}));

describe('RawBodyMiddleware', () => {
  let middleware: RawBodyMiddleware;

  beforeEach(() => {
    (raw as jest.Mock).mockClear();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RawBodyMiddleware],
    }).compile();

    middleware = module.get<RawBodyMiddleware>(RawBodyMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should use raw body parser for webhook routes', () => {
    const req = { originalUrl: '/api/v1/webhooks/facebook' } as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(raw).toHaveBeenCalledWith({ type: 'application/json' });
    expect(next).toHaveBeenCalled();
  });

  it('should call next() for non-webhook routes', () => {
    const req = { originalUrl: '/api/v1/users' } as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(raw).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
