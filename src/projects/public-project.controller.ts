// src/projects/public-project.controller.ts
import {
  Controller,
  Get,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { type Request } from 'express';

@Controller('/api/v1/public/projects')
export class PublicProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get(':id/widget-settings')
  async getWidgetSettings(@Param('id') id: number, @Req() req: Request) {
    const origin = req.headers.origin;
    const settings = await this.projectService.getWidgetSettings(id, origin);
    if (!settings) {
      throw new ForbiddenException('Access from this origin is not allowed.');
    }
    return settings;
  }
}
