import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let entityManager: EntityManager;

  const USER_REPOSITORY_TOKEN = getRepositoryToken(User);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY_TOKEN,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            preload: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(USER_REPOSITORY_TOKEN);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user within a transaction', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
      };
      const newUser = new User();
      Object.assign(newUser, createUserDto);

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          const transactionalEntityManager = {
            save: jest.fn().mockResolvedValue(newUser),
          };
          return await cb(transactionalEntityManager);
        }
      );

      jest.spyOn(userRepository, 'create').mockReturnValue(newUser);

      const result = await service.create(createUserDto);

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(newUser);
    });
  });

  describe('updateProfile', () => {
    it('should update a user profile within a transaction', async () => {
      const userId = 'some-uuid';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Test User',
      };
      const existingUser = new User();
      const updatedUser = new User();
      Object.assign(updatedUser, existingUser, updateUserDto);

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          const transactionalEntityManager = {
            save: jest.fn().mockResolvedValue(updatedUser),
          };
          return await cb(transactionalEntityManager);
        }
      );

      jest.spyOn(userRepository, 'preload').mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, updateUserDto);

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(userRepository.preload).toHaveBeenCalledWith({
        id: userId,
        ...updateUserDto,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw an error if user to update is not found', async () => {
      const userId = 'some-uuid';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Test User',
      };

      (entityManager.transaction as jest.Mock).mockImplementation(
        async (cb) => {
          jest.spyOn(userRepository, 'preload').mockResolvedValue(undefined);
          const transactionalEntityManager = {
            save: jest.fn(),
          };
          return await cb(transactionalEntityManager);
        }
      );

      await expect(
        service.updateProfile(userId, updateUserDto)
      ).rejects.toThrow(`User with ID ${userId} not found`);
    });
  });
});
