import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    userId: string
  ): Promise<Project> {
    const project = this.projectRepository.create({
      ...createProjectDto,
      userId,
    });
    return this.projectRepository.save(project);
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.projectRepository.find({ where: { userId } });
  }

  async findOne(id: number, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id });
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
    const project = await this.findOne(id, userId); // Ownership check
    const updated = await this.projectRepository.save({
      ...project,
      ...updateProjectDto,
    });
    return updated;
  }
}
