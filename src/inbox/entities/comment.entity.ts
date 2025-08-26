// src/inbox/entities/comment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { FacebookParticipant } from './facebook-participant.entity';

// Enum for comment status
export enum CommentStatus {
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  RECEIVED = 'received', // For comments coming from Facebook
}

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'uuid' })
  connectedPageId: string;

  @ManyToOne(() => ConnectedPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_page_id' })
  connectedPage: ConnectedPage;

  @Index()
  @Column({ type: 'bigint', nullable: true })
  parentCommentId: number | null;

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment: Comment | null;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];

  @Column({ unique: true, nullable: true }) // Can be null initially for optimistic UI
  facebookCommentId: string;

  @Index()
  @Column()
  facebookPostId: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: any | null;

  @Column()
  senderId: string;

  @Column()
  fromCustomer: boolean;

  @Column({
    type: 'enum',
    enum: CommentStatus,
    default: CommentStatus.RECEIVED,
  })
  status: CommentStatus;

  @Column({ type: 'timestamptz' })
  createdAtFacebook: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
