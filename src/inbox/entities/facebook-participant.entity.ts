import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('facebook_participants')
export class FacebookParticipant {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'facebook_user_id' })
  facebookUserId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true, name: 'profile_pic_url' })
  profilePicUrl: string | null; // SỬA LỖI: string -> string | null

  @OneToMany(() => Conversation, (conversation) => conversation.participant)
  conversations: Conversation[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
