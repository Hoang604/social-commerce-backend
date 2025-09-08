import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Conversation } from './conversation.entity';

@Entity('visitors')
export class Visitor {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  projectId: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Index('idx_visitor_uid')
  @Column({ type: 'uuid', unique: true })
  visitorUid: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: object;

  @OneToMany(() => Conversation, (conversation) => conversation.visitor)
  conversations: Conversation[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt?: Date;
}
