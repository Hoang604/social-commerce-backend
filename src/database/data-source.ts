import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Conversation } from '../inbox/entities/conversation.entity';
import { Message } from '../inbox/entities/message.entity';
import { Visitor } from '../inbox/entities/visitor.entity';
import { Project } from '../projects/entities/project.entity';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { TwoFactorRecoveryCode } from 'src/auth/entities/two-factor-recovery-code.entity';
import { UserIdentity } from 'src/auth/entities/user-identity.entity';

dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('PSQL_HOST') || 'localhost',
  port: configService.get<number>('PSQL_PORT') || 5432,
  username: configService.get<string>('PSQL_USER') || 'hoang',
  password: configService.get<string>('PSQL_PASSWORD') || '',
  database: configService.get<string>('PSQL_DATABASE') || 'your_database',
  synchronize: false,
  logging: false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
});
