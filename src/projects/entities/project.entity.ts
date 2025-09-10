import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Conversation } from '../../inbox/entities/conversation.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Conversation, (conversation) => conversation.project)
  conversations: Conversation[];

  @Column()
  name: string;

  @Column({ nullable: true })
  siteUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  widgetSettings: object;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'whitelisted_domains',
  })
  whitelistedDomains: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
