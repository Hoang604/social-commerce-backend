import { RefreshToken } from 'src/auth/entities/refresh-token.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
// Import các entity khác khi bạn tạo chúng
// import { Subscription } from '../../billing/entities/subscription.entity';
// import { ConnectedPage } from '../../facebook-connect/entities/connected-page.entity';

// Định nghĩa enum cho trạng thái người dùng để đảm bảo dữ liệu nhất quán
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

  // Một user có thể kết nối nhiều page
  @OneToMany(() => ConnectedPage, (page) => page.user)
  connectedPages: ConnectedPage[];
  */

  // --- Nhóm 4: Dấu vết Thời gian ---
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
