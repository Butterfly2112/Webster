import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto } from './dto/save-project.dto';
import { UserService } from 'src/user/user.service';
import { Asset, Project } from '@prisma/client';
import {
  CardProjectHistoryDto,
  ProjectCardDto,
  SafeAssetDto,
  SafeProjectDto,
} from './dto/safe-project.dto';
import { UploadService } from 'src/upload/upload.service';
import { UpdateProjectDto } from './dto/update-project.dto';

const EMPTY_CANVAS = {
  className: 'Stage',
  attrs: {},
  children: [{ className: 'Layer', attrs: {}, children: [] }],
};

const MAX_HISTORY_VERSIONS = 20;

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private uploadService: UploadService,
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
        await this.safeDeleteFile(dto.thumbnail_public_id);
        throw new NotFoundException('Template not found');
      }

      const isSystemTemplate = template.owner_id === null;
      const isOwnTemplate = template.owner_id === userId;

      if (!isSystemTemplate && !isOwnTemplate) {
        await this.safeDeleteFile(dto.thumbnail_public_id);
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
        thumbnail_public_id: dto.thumbnail_public_id,
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
      include: { assets: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.owner_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toSafeProject(project as Project & { assets: Asset[] });
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

  async updateProject(
    projectId: number,
    dto: UpdateProjectDto,
    userId: number,
  ): Promise<SafeProjectDto> {
    await this.checkRights(projectId, userId, dto.thumbnail_public_id);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.canvasData !== undefined && { canvas_data: dto.canvasData }),
        ...(dto.thumbnailUrl !== undefined && {
          thumbnail_url: dto.thumbnailUrl,
        }),
        ...(dto.thumbnail_public_id !== undefined && {
          thumbnail_public_id: dto.thumbnail_public_id,
        }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.isTemplate !== undefined && { is_template: dto.isTemplate }),
      },
    });

    if (dto.canvasData) {
      await this.saveHistorySnapshot(
        projectId,
        updated.canvas_data as object,
        updated.thumbnail_url,
        updated.thumbnail_public_id,
      );
    }

    return this.toSafeProject(updated);
  }

  async getProjectHistory(
    projectId: number,
    userId: number,
  ): Promise<CardProjectHistoryDto[]> {
    await this.checkRights(projectId, userId);

    return this.prisma.projectHistory.findMany({
      where: { project_id: projectId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        thumbnail_url: true,
        created_at: true,
      },
    });
  }

  async restoreVersion(
    projectId: number,
    historyId: number,
    userId: number,
  ): Promise<SafeProjectDto> {
    const currentProject = await this.checkRights(projectId, userId);

    const historyEntry = await this.prisma.projectHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyEntry || historyEntry.project_id !== projectId) {
      throw new NotFoundException('History version not found');
    }

    await this.saveHistorySnapshot(
      projectId,
      currentProject.canvas_data as object,
    );

    const restored = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        canvas_data: historyEntry.canvas_data as object,
        thumbnail_url: historyEntry.thumbnail_url,
        thumbnail_public_id: historyEntry.thumbnail_public_id,
      },
    });

    return this.toSafeProject(restored);
  }

  async deleteProject(projectId: number, userId: number): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { assets: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.owner_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (project.thumbnail_public_id) {
      this.safeDeleteFile(project.thumbnail_public_id);
    }
    const files = await this.prisma.projectHistory.findMany({
      where: { project_id: projectId },
      select: { thumbnail_public_id: true },
    });

    files.map((item) => {
      if (item.thumbnail_public_id)
        this.safeDeleteFile(item.thumbnail_public_id);
    });

    project.assets.map((asset) => {
      this.safeDeleteFile(asset.public_id);
    });

    await this.prisma.asset.deleteMany({ where: { project_id: projectId } });
    await this.prisma.projectHistory.deleteMany({
      where: { project_id: projectId },
    });
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async uploadProjectAsset(
    projectId: number,
    userId: number,
    file: Express.Multer.File,
  ): Promise<SafeAssetDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    await this.checkRights(projectId, userId);

    const uploaded = await this.uploadService.uploadImage(file);

    const asset = await this.prisma.asset.create({
      data: {
        type: 'image',
        url: uploaded.url,
        public_id: uploaded.public_id,
        original_name: file.originalname,
        file_size: file.size,
        owner_id: userId,
        project_id: projectId,
      },
    });

    return this.toSafeAsset(asset);
  }

  async getProjectAsset(
    assetId: number,
    userId: number,
  ): Promise<SafeAssetDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    if (asset.owner_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toSafeAsset(asset);
  }

  async getProjectAssets(
    projectId: number,
    userId: number,
  ): Promise<SafeAssetDto[]> {
    const project = await this.getProjectById(projectId, userId);
    return project.assets || [];
  }

  async deleteProjectAsset(assetId: number, userId: number): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    if (asset.owner_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.safeDeleteFile(asset.public_id);
    await this.prisma.asset.delete({ where: { id: assetId } });
  }

  private async checkRights(
    projectId: number,
    userId: number,
    thumbnailPublicId?: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      await this.safeDeleteFile(thumbnailPublicId);
      throw new NotFoundException('Project not found');
    }

    if (project.owner_id !== userId) {
      await this.safeDeleteFile(thumbnailPublicId);
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  private async safeDeleteFile(
    public_id: string | null | undefined,
  ): Promise<void> {
    if (!public_id) return;
    try {
      await this.uploadService.deleteFile(public_id);
    } catch {
      console.warn(`Failed to delete Cloudinary file: ${public_id}`);
    }
  }

  private async saveHistorySnapshot(
    projectId: number,
    canvasData: object,
    thumbnail_url?: string | null,
    thumbnail_public_id?: string | null,
  ): Promise<void> {
    const lastHistory = await this.prisma.projectHistory.findFirst({
      where: { project_id: projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (lastHistory?.version ?? 0) + 1;

    await this.prisma.projectHistory.create({
      data: {
        project_id: projectId,
        canvas_data: canvasData,
        version: nextVersion,
        thumbnail_url: thumbnail_url,
        thumbnail_public_id: thumbnail_public_id,
      },
    });

    const allVersions = await this.prisma.projectHistory.findMany({
      where: { project_id: projectId },
      orderBy: { version: 'desc' },
      select: { id: true, thumbnail_public_id: true },
    });

    if (allVersions.length > MAX_HISTORY_VERSIONS) {
      const versionsToDelete = allVersions.slice(MAX_HISTORY_VERSIONS);

      const idsToDelete = versionsToDelete.map((h) => h.id);
      const thumbnailsToDelete = versionsToDelete
        .map((h) => h.thumbnail_public_id)
        .filter(Boolean);

      await this.prisma.projectHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      await Promise.allSettled(
        thumbnailsToDelete.map((id) => this.safeDeleteFile(id)),
      );
    }
  }

  private toSafeProject(
    project: Project & { assets?: Asset[] },
  ): SafeProjectDto {
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
      assets: project.assets ? project.assets.map(this.toSafeAsset) : undefined,
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

  private toSafeAsset(asset: Asset): SafeAssetDto {
    return {
      id: asset.id,
      type: asset.type,
      url: asset.url,
      original_name: asset.original_name,
      file_size: asset.file_size,
      project_id: asset.project_id || undefined,
    };
  }
}
