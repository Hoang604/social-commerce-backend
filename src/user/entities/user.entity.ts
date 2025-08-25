import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SocialAccount } from '../../auth/entities/social-account.entity';
import { TwoFactorRecoveryCode } from '../../auth/entities/two-factor-recovery-code.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  // --- Nhóm 1: Định danh & Xác thực ---
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  // --- Nhóm 2: Thông tin Cá nhân & UX ---
  @Column({ type: 'varchar', nullable: true })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string;

  @Column({ type: 'varchar', default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Column({ type: 'varchar', length: 2, default: 'vi' })
  language: string;

  // --- Nhóm 3: Trạng thái, Vai trò & Quan hệ ---
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  hashedRefreshTokens: RefreshToken[];

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  tokensValidFrom: Date;

  @OneToMany(() => ConnectedPage, (page) => page.user)
  connectedPages: ConnectedPage[];

  // --- Nhóm 5: Tính năng mới (2FA & Social Login) ---
  @Column({ default: false })
  isTwoFactorAuthenticationEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  twoFactorAuthenticationSecret: string | null;

  @OneToMany(() => SocialAccount, (account) => account.user)
  socialAccounts: SocialAccount[];

  @OneToMany(() => TwoFactorRecoveryCode, (code) => code.user)
  recoveryCodes: TwoFactorRecoveryCode[];

  // --- Nhóm 4: Dấu vết Thời gian ---
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
