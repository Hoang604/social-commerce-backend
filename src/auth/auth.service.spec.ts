jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../user/user.service');

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import { User } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService, // Added UserService back here
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            transaction: jest.fn((cb) => cb({
              getRepository: jest.fn().mockReturnValue({}),
            })),
            getRepository: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    };

    const hashedPassword = 'hashedPassword123';
    const newUser = {
      id: 'some-uuid',
      email: registerDto.email,
      passwordHash: hashedPassword,
      fullName: registerDto.fullName,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (entityManager.transaction as jest.Mock).mockImplementation(async (cb) => {
        const transactionEntityManager = {
          getRepository: jest.fn((entity) => {
            if (entity === User) {
              return {};
            }
            if (entity === RefreshToken) {
              return {};
            }
            return {};
          }),
        };
        return cb(transactionEntityManager);
      });

      (UserService.prototype.findOneByEmail as jest.Mock).mockClear();
      (UserService.prototype.create as jest.Mock).mockClear();
    });

    it('should successfully register a new user', async () => {
      (UserService.prototype.findOneByEmail as jest.Mock).mockResolvedValue(null);
      (UserService.prototype.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.register(registerDto);

      expect(UserService.prototype.findOneByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(UserService.prototype.create).toHaveBeenCalledWith({
        email: registerDto.email,
        passwordHash: hashedPassword,
        fullName: registerDto.fullName,
      });
      expect(result).toEqual(expect.objectContaining({
        email: registerDto.email,
        fullName: registerDto.fullName,
      }));
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException if email already exists', async () => {
      (UserService.prototype.findOneByEmail as jest.Mock).mockResolvedValue(newUser);

      await expect(service.register(registerDto)).rejects.toThrow('Email này đã được sử dụng.');
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(UserService.prototype.findOneByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(UserService.prototype.create).not.toHaveBeenCalled();
    });
  });
});