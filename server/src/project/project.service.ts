import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto } from './dto/save-project.dto';
import { UserService } from 'src/user/user.service';
import { Project } from '@prisma/client';
import { ProjectCardDto, SafeProjectDto } from './dto/safe-project.dto';

const EMPTY_CANVAS = {
  className: 'Stage',
  attrs: {},
  children: [{ className: 'Layer', attrs: {}, children: [] }],
};

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async createProject(
    dto: CreateProjectDto,
    userId: number,
  ): Promise<SafeProjectDto> {
    const user = await this.userService.findById(userId);

    let initialCanvasData: object = EMPTY_CANVAS;

    if (dto.sourceTemplateId) {
      const template = await this.prisma.project.findUnique({
        where: { id: dto.sourceTemplateId },
      });

      if (!template || !template.is_template) {
        throw new NotFoundException('Template not found');
      }

      const isSystemTemplate = template.owner_id === null;
      const isOwnTemplate = template.owner_id === userId;

      if (!isSystemTemplate && !isOwnTemplate) {
        throw new ForbiddenException('No access to this template');
      }

      initialCanvasData = template.canvas_data as object;
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        canvas_data: dto.canvasData ?? initialCanvasData,
        width: dto.width ?? 800,
        height: dto.height ?? 600,
        thumbnail_url: dto.thumbnailUrl,
        is_template: false,
        owner_id: user.id,
      },
    });

    return this.toSafeProject(project);
  }

  async getProjectById(
    projectId: number,
    userId: number,
  ): Promise<SafeProjectDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.owner_id !== userId) {
      throw new ForbiddenException('Only owner of the project can open it');
    }

    return this.toSafeProject(project);
  }

  async getUserProjects(userId: number): Promise<ProjectCardDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { owner_id: userId, is_template: false },
      orderBy: { updated_at: 'desc' },
    });

    return projects.map(this.toProjectCard);
  }

  async getTemplates(userId: number): Promise<ProjectCardDto[]> {
    const templates = await this.prisma.project.findMany({
      where: {
        is_template: true,
        OR: [{ owner_id: null }, { owner_id: userId }],
      },
      orderBy: [{ owner_id: 'asc' }, { updated_at: 'desc' }],
    });

    return templates.map(this.toProjectCard);
  }

  private toSafeProject(project: Project): SafeProjectDto {
    return {
      id: project.id,
      title: project.title,
      description: project.description || undefined,
      canvasData: project.canvas_data as object,
      width: project.width,
      height: project.height,
      thumbnailUrl: project.thumbnail_url || undefined,
      isTemplate: project.is_template,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      ownerId: project.owner_id,
    };
  }

  private toProjectCard(project: Project): ProjectCardDto {
    return {
      id: project.id,
      title: project.title,
      description: project.description || undefined,
      width: project.width,
      height: project.height,
      thumbnailUrl: project.thumbnail_url || undefined,
      isTemplate: project.is_template,
      updatedAt: project.updated_at,
      ownerId: project.owner_id,
    };
  }
}
