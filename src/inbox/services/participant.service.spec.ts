import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantService } from './participant.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FacebookParticipant } from '../entities/facebook-participant.entity';
import { Repository, EntityManager } from 'typeorm';

describe('ParticipantService', () => {
  let service: ParticipantService;
  let repository: Repository<FacebookParticipant>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantService,
        {
          provide: getRepositoryToken(FacebookParticipant),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ParticipantService>(ParticipantService);
    repository = module.get<Repository<FacebookParticipant>>(getRepositoryToken(FacebookParticipant));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsert', () => {
    it('should update existing participant', async () => {
        const participantData = { facebookUserId: 'fbUserId', name: 'New Name' };
        const existingParticipant = new FacebookParticipant();
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn().mockResolvedValue(existingParticipant),
                save: jest.fn().mockImplementation(async (p) => p),
            }),
        } as any;

        const result = await service.upsert(participantData, manager);

        expect(result.name).toEqual('New Name');
    });

    it('should create new participant if not found', async () => {
        const participantData = { facebookUserId: 'fbUserId', name: 'New Name' };
        const manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockReturnValue(new FacebookParticipant()),
                save: jest.fn().mockImplementation(async (p) => p),
            }),
        } as any;

        await service.upsert(participantData, manager);

        expect(manager.getRepository().create).toHaveBeenCalledWith(expect.objectContaining(participantData));
    });
  });
});
