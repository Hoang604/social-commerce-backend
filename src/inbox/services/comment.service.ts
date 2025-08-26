// src/inbox/services/comment.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Comment, CommentStatus } from '../entities/comment.entity';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { ReplyToCommentDto } from '../dto/reply-to-comment.dto';
import { FacebookApiService } from '../../facebook-api/facebook-api.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EncryptionService } from 'src/common/services/encryption.service';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ConnectedPage)
    private readonly connectedPageRepository: Repository<ConnectedPage>,
    private readonly facebookApiService: FacebookApiService,
    private readonly eventsGateway: EventsGateway,
    private readonly encryptionService: EncryptionService,
    private readonly entityManager: EntityManager
  ) {}

  async listByPost(
    userId: string,
    facebookPostId: string,
    paginationDto: PaginationDto
  ) {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;

    const postExistsOnUserPage = await this.connectedPageRepository
      .createQueryBuilder('page')
      .innerJoin(Comment, 'comment', 'comment.connectedPageId = page.id')
      .where('page.userId = :userId', { userId })
      .andWhere('comment.facebookPostId = :facebookPostId', {
        facebookPostId,
      })
      .getExists();

    if (!postExistsOnUserPage) {
      throw new ForbiddenException(
        'You do not have permission to view comments for this post.'
      );
    }

    const [data, total] = await this.commentRepository.findAndCount({
      where: { facebookPostId },
      relations: ['parentComment', 'replies'],
      order: { createdAtFacebook: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async replyToComment(
    userId: string,
    parentCommentId: number,
    dto: ReplyToCommentDto
  ): Promise<Comment> {
    let newComment: Comment;

    const parentComment = await this.commentRepository.findOne({
      where: { id: parentCommentId },
      relations: ['connectedPage'],
    });

    if (!parentComment) {
      throw new NotFoundException('Parent comment not found');
    }

    if (parentComment.connectedPage.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to reply to this comment.'
      );
    }

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        newComment = transactionalEntityManager.create(Comment, {
          content: dto.text,
          parentCommentId: parentComment.id,
          connectedPageId: parentComment.connectedPageId,
          facebookPostId: parentComment.facebookPostId,
          status: CommentStatus.SENDING,
          fromCustomer: false,
          senderId: parentComment.connectedPage.facebookPageId,
          createdAtFacebook: new Date(),
        });

        await transactionalEntityManager.save(newComment);

        this.eventsGateway.sendToUser(userId, 'comment:created', newComment);

        try {
          const pageAccessToken = this.encryptionService.decrypt(
            parentComment.connectedPage.encryptedPageAccessToken
          );

          const { id: newFbCommentId } =
            await this.facebookApiService.replyToComment(
              pageAccessToken,
              parentComment.facebookCommentId,
              dto.text
            );

          newComment.status = CommentStatus.SENT;
          newComment.facebookCommentId = newFbCommentId;
          await transactionalEntityManager.save(newComment);

          this.eventsGateway.sendToUser(userId, 'comment:updated', {
            id: newComment.id,
            status: 'sent',
            facebookCommentId: newFbCommentId,
          });
        } catch (error) {
          this.logger.error(
            `Failed to send comment reply for comment ${newComment.id}`,
            error.stack
          );
          newComment.status = CommentStatus.FAILED;
          await transactionalEntityManager.save(newComment);

          this.eventsGateway.sendToUser(userId, 'comment:updated', {
            id: newComment.id,
            status: 'failed',
          });

          throw new InternalServerErrorException(
            'Failed to send reply to Facebook.'
          );
        }

        return newComment;
      }
    );
  }
}
