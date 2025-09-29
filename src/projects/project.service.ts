import { Injectable, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WidgetSettingsDto } from './dto/widget-settings.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(private readonly entityManager: EntityManager) {}

  async create(
    createProjectDto: CreateProjectDto,
    userId: string
  ): Promise<Project> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const project = transactionalEntityManager.create(Project, {
          ...createProjectDto,
          userId,
        });
        return transactionalEntityManager.save(project);
      }
    );
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.entityManager.find(Project, { where: { userId } });
  }

  async findByProjectId(projectId: number): Promise<Project | null> {
    return this.entityManager.findOneBy(Project, { id: projectId });
  }

  async findOne(id: number, userId: string): Promise<Project> {
    const project = await this.entityManager.findOneBy(Project, { id });
    if (!project || project.userId !== userId) {
      throw new ForbiddenException('Access to this project is denied.');
    }
    return project;
  }

  async update(
    id: number,
    updateProjectDto: UpdateProjectDto,
    userId: string
  ): Promise<Project> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const project = await transactionalEntityManager.findOneBy(Project, {
          id,
        });
        if (!project || project.userId !== userId) {
          throw new ForbiddenException('Access to this project is denied.');
        }
        const updated = await transactionalEntityManager.save(Project, {
          ...project,
          ...updateProjectDto,
        });
        return updated;
      }
    );
  }
  public async getWidgetSettings(
    id: number,
    origin: string | undefined
  ): Promise<{ primaryColor: string; welcomeMessage: string } | null> {
    const project = await this.entityManager.findOneBy(Project, { id });

    if (!project) {
      this.logger.warn(`Project with ID ${id} not found.`);
      return null;
    }

    if (project.whitelistedDomains && project.whitelistedDomains.length > 0) {
      if (origin) {
        this.logger.log(`Validating origin: ${origin}`);
        const originUrl = new URL(origin);
        const originDomain = originUrl.hostname;
        if (!project.whitelistedDomains.includes(originDomain)) {
          this.logger.warn(
            `Origin ${originDomain} is not whitelisted for project ${id}.`
          );
          return null;
        }
      } else {
        this.logger.warn(`No origin provided for project ${id}.`);
        return null;
      }
    }

    const settings = project.widgetSettings as {
      primaryColor?: string;
      welcomeMessage?: string;
    };

    return {
      primaryColor: settings?.primaryColor || '#1a73e8',
      welcomeMessage:
        settings?.welcomeMessage ||
        'Chào bạn, chúng tôi có thể giúp gì cho bạn?',
    };
  }

  async updateWidgetSettings(
    id: number,
    userId: string,
    settingsDto: WidgetSettingsDto
  ): Promise<Project> {
    const project = await this.findOne(id, userId);

    project.widgetSettings = {
      ...project.widgetSettings,
      ...settingsDto,
    };

    return this.entityManager.save(project);
  }
}
