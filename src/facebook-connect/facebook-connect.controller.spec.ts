import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectController } from './facebook-connect.controller';

describe('FacebookConnectController', () => {
  let controller: FacebookConnectController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacebookConnectController],
    }).compile();

    controller = module.get<FacebookConnectController>(FacebookConnectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
