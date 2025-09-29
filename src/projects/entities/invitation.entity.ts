// src/projects/entities/invitation.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

/**
 * @description
 * This entity stores pending invitations for users to join a project.
 * It contains a unique token that will be sent via email.
 */
@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  /**
   * @description
   * A secure, unique, and non-guessable token for the invitation link.
   */
  @Column({ unique: true })
  token: string;

  @Column()
  projectId: number;

  /**
   * @description
   * The ID of the manager who sent the invitation.
   */
  @Column('uuid')
  inviterId: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  /**
   * @description
   * The timestamp when this invitation will expire and become invalid.
   */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
