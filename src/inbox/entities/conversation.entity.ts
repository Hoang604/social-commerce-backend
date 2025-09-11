import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';
import { Project } from 'src/projects/entities/project.entity';
import { Visitor } from './visitor.entity';

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  PENDING = 'pending',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @ManyToOne(() => Project, (project) => project.conversations, {
    onDelete: 'SET NULL',
  })
  @Column({ type: 'bigint', name: 'project_id' })
  projectId: number;

  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Visitor, (visitor) => visitor.conversations, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'visitor_id' })
  visitor: Visitor;

  @Column({ type: 'text', nullable: true, name: 'last_message_snippet' })
  lastMessageSnippet: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'last_message_timestamp',
  })
  lastMessageTimestamp: Date | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status: ConversationStatus;

  @Column({ type: 'integer', default: 0, name: 'unread_count' })
  unreadCount: number;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
