import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from '../../inbox/entities/conversation.entity';
import { WidgetSettingsDto } from '../dto/widget-settings.dto';
import { ProjectMember } from './project-member.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToMany(() => Conversation, (conversation) => conversation.project)
  conversations: Conversation[];

  @Column()
  name: string;

  @Column({ nullable: true })
  siteUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  widgetSettings: WidgetSettingsDto;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'whitelisted_domains',
  })
  whitelistedDomains: string[];

  @OneToMany(() => ProjectMember, (member) => member.project)
  members: ProjectMember[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
