import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { FacebookConnectController } from './facebook-connect.controller';
import { FacebookConnectService } from './facebook-connect.service';
import { ConnectedPage } from './entities/connected-page.entity';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConnectedPage]),
    HttpModule, // Import HttpModule để có thể inject HttpService
  ],
  controllers: [FacebookConnectController],
  providers: [FacebookConnectService, EncryptionService], // Thêm EncryptionService vào providers
})
export class FacebookConnectModule {}
