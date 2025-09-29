// src/projects/entities/project-member.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique, // Import Unique
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Project } from './project.entity';
import { Role } from '../../rbac/roles.enum';

@Entity('project_members')
@Unique(['userId', 'projectId']) // Ensures a user can only be a member of a project once.
export class ProjectMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column('uuid') // Make sure the type matches the User's id type
  userId: string;

  @Column({
    type: 'enum',
    enum: Role,
    // The role of the user within this specific project.
    comment: 'The role of the user within this specific project.',
  })
  role: Role;

  @ManyToOne(() => Project, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, (user) => user.projectMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Timestamp for when the membership was created.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Timestamp for when the membership was last updated.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
