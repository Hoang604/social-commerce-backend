import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectController } from './facebook-connect.controller';
import { FacebookConnectService } from './facebook-connect.service';

describe('FacebookConnectController', () => {
  let controller: FacebookConnectController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacebookConnectController],
      providers: [
        {
          provide: FacebookConnectService,
          useValue: {
            // Mock methods of FacebookConnectService if needed for controller tests
          },
        },
      ],
    }).compile();

    controller = module.get<FacebookConnectController>(FacebookConnectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
