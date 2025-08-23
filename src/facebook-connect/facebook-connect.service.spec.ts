import { Test, TestingModule } from '@nestjs/testing';
import { FacebookConnectService } from './facebook-connect.service';

describe('FacebookConnectService', () => {
  let service: FacebookConnectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FacebookConnectService],
    }).compile();

    service = module.get<FacebookConnectService>(FacebookConnectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
