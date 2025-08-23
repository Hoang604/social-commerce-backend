import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';

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

  @Column({ type: 'varchar' })
  passwordHash: string;

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

  /*
  // --- Định nghĩa các mối quan hệ (sẽ được kích hoạt khi bạn tạo các entity tương ứng) ---
  
  // Một user chỉ có một subscription
  @OneToOne(() => Subscription, (subscription) => subscription.user)
  subscription: Subscription;
  */
  /**
   * Stores the timestamp from which tokens are considered valid.
   * Used to invalidate all tokens before this time upon logout-all or password change.
   */
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  tokensValidFrom: Date;

  // Một user có thể kết nối nhiều page
  @OneToMany(() => ConnectedPage, (page) => page.user)
  connectedPages: ConnectedPage[];

  // --- Nhóm 4: Dấu vết Thời gian ---
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
