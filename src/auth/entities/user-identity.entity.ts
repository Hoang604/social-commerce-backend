import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('user_identities')
@Unique(['provider', 'providerId'])
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string; // 'google', 'local', etc.

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
