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
  public async getWidgetSettings(
    id: number,
    origin: string | undefined
  ): Promise<{ primaryColor: string; welcomeMessage: string } | null> {
    const project = await this.projectRepository.findOneBy({ id });

    if (!project) {
      return null; // Không tìm thấy project
    }

    // Logic kiểm tra domain vẫn giữ nguyên
    if (project.whitelistedDomains && project.whitelistedDomains.length > 0) {
      if (origin) {
        const originUrl = new URL(origin);
        const originDomain = originUrl.hostname;
        if (!project.whitelistedDomains.includes(originDomain)) {
          return null; // Origin không được phép
        }
      } else {
        return null; // Nếu có whitelist, bắt buộc phải có origin
      }
    }

    // SỬA LỖI: Truy cập vào các thuộc tính lồng trong widgetSettings
    // Giả định rằng widgetSettings có kiểu { primaryColor: string, welcomeMessage: string }
    const settings = project.widgetSettings as {
      primaryColor?: string;
      welcomeMessage?: string;
    };

    return {
      primaryColor: settings?.primaryColor || '#1a73e8', // Cung cấp giá trị mặc định
      welcomeMessage:
        settings?.welcomeMessage ||
        'Chào bạn, chúng tôi có thể giúp gì cho bạn?', // Cung cấp giá trị mặc định
    };
  }
}
