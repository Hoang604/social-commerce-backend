import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EncryptionService } from 'src/common/services/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  providers: [UserService, EncryptionService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
