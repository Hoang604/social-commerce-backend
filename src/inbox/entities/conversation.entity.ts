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
import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { Message } from './message.entity';
import { FacebookParticipant } from './facebook-participant.entity';

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  PENDING = 'pending',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'uuid', name: 'connected_page_id' })
  connectedPageId: string;

  @ManyToOne(() => ConnectedPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_page_id' })
  connectedPage: ConnectedPage;

  @Index()
  @Column({ type: 'bigint', name: 'participant_id' })
  participantId: number;

  @ManyToOne(() => FacebookParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: FacebookParticipant;

  @Column({ unique: true, name: 'facebook_conversation_id' })
  facebookConversationId: string;

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
