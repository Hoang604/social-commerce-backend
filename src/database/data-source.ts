import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { ConnectedPage } from '../facebook-connect/entities/connected-page.entity';
import { Conversation } from '../inbox/entities/conversation.entity';
import { Message } from '../inbox/entities/message.entity';
import { Comment } from '../inbox/entities/comment.entity';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { FacebookParticipant } from '../inbox/entities/facebook-participant.entity';

dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('psql_host') || 'localhost',
  port: configService.get<number>('psql_port') || 5432,
  username: configService.get<string>('psql_user') || 'hoang',
  password: configService.get<string>('psql_password') || '',
  database: configService.get<string>('psql_database') || 'your_database',
  synchronize: false,
  logging: false,
  entities: [
    User,
    RefreshToken,
    ConnectedPage,
    Conversation,
    Message,
    Comment,
    FacebookParticipant,
  ],
  migrations: ['src/database/migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
});
