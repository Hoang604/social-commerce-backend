import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WidgetSettingsDto } from './dto/widget-settings.dto';
import { ProjectMember } from './entities/project-member.entity';
import { Role } from '../rbac/roles.enum';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly entityManager: EntityManager) {}

  /**
   * Validates if a user is a member of a project.
   * Throws a ForbiddenException if not.
   * @returns The project entity if validation is successful.
   */
  async validateProjectMembership(
    projectId: number,
    userId: string
  ): Promise<Project> {
    const membership = await this.entityManager.findOne(ProjectMember, {
      where: { projectId, userId },
      relations: ['project'],
    });

    if (!membership) {
      throw new ForbiddenException('Access to this project is denied.');
    }

    return membership.project;
  }

  async create(
    createProjectDto: CreateProjectDto,
    userId: string
  ): Promise<Project> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Create the project instance without userId
        const project = transactionalEntityManager.create(
          Project,
          createProjectDto
        );
        const savedProject = await transactionalEntityManager.save(project);

        // Automatically make the creator a member with the MANAGER role
        const membership = transactionalEntityManager.create(ProjectMember, {
          projectId: savedProject.id,
          userId: userId,
          role: Role.MANAGER,
        });
        await transactionalEntityManager.save(membership);

        return savedProject;
      }
    );
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    const memberships = await this.entityManager.find(ProjectMember, {
      where: { userId },
      relations: ['project'],
    });
    return memberships.map((membership) => membership.project);
  }

  async findByProjectId(projectId: number): Promise<Project | null> {
    return this.entityManager.findOneBy(Project, { id: projectId });
  }

  async findOne(id: number, userId: string): Promise<Project> {
    return this.validateProjectMembership(id, userId);
  }

  async update(
    id: number,
    updateProjectDto: UpdateProjectDto,
    userId: string
  ): Promise<Project> {
    // Step 1: Validate membership and get the managed entity.
    // 'project' is the actual entity from the database.
    const project = await this.validateProjectMembership(id, userId);

    // Step 2: Copy the properties from the DTO to the fetched entity.
    // Object.assign updates 'project' in place with new values from the DTO.
    Object.assign(project, updateProjectDto);

    // Step 3: Save the modified entity.
    // TypeORM knows this is an existing entity because it has an 'id'
    // and is managed, so it will perform an UPDATE query.
    return this.entityManager.save(project);
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

    // Start of new "fail-closed" logic
    if (!origin) {
      this.logger.warn(
        `Request for project ${id} is missing an Origin header. Access denied.`
      );
      return null;
    }

    if (!project.whitelistedDomains || project.whitelistedDomains.length === 0) {
      this.logger.warn(
        `Project ${id} has no whitelisted domains configured. Access denied for origin ${origin}.`
      );
      return null;
    }
    // End of new "fail-closed" logic

    this.logger.log(`Validating origin: ${origin} for project ${id}`);
    const originUrl = new URL(origin);
    const originDomain = originUrl.hostname;

    if (!project.whitelistedDomains.includes(originDomain)) {
      this.logger.warn(
        `Origin ${originDomain} is not whitelisted for project ${id}.`
      );
      return null;
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
    const project = await this.validateProjectMembership(id, userId);

    project.widgetSettings = {
      ...project.widgetSettings,
      ...settingsDto,
    };

    return this.entityManager.save(project);
  }
}
