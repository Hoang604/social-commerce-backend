import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { AuthModule } from '../auth/auth.module';
import { PublicProjectController } from './public-project.controller';
import { ProjectMember } from './entities/project-member.entity';
import { Invitation } from './entities/invitation.entity';
import { InvitationService } from './invitation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember, Invitation]),
    AuthModule,
  ],
  providers: [ProjectService, InvitationService],
  controllers: [ProjectController, PublicProjectController],
})
export class ProjectModule {}
