// src/inbox/services/comment.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CommentService } from './comment.service';
import { Comment } from '../entities/comment.entity';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { User } from '../../user/entities/user.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CommentService', () => {
  let service: CommentService;
  let commentRepository: Repository<Comment>;
  let pageRepository: Repository<ConnectedPage>;
  let facebookApiService: FacebookApiService;
  let eventsGateway: EventsGateway;
  let entityManager: EntityManager;

  // Mocks for dependencies
  const mockCommentRepository = {
    // ... mock methods
  };
  const mockPageRepository = {
    // ... mock methods
  };
  const mockFacebookApiService = {
    replyToComment: jest.fn(),
  };
  const mockEventsGateway = {
    emitToUser: jest.fn(),
  };
  const mockEntityManager = {
    transaction: jest.fn().mockImplementation(async (callback) => {
      // Mock transaction logic
      const transactionalEntityManager = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };
      return await callback(transactionalEntityManager);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepository,
        },
        {
          provide: getRepositoryToken(ConnectedPage),
          useValue: mockPageRepository,
        },
        {
          provide: FacebookApiService,
          useValue: mockFacebookApiService,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    // ... initialize other mocked services
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more detailed tests for replyToComment (success, failure, auth)
  // and listByPost (success, auth) here.
});
