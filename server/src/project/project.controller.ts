import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateProjectDto,
  CreateProjectDtoD,
  RestoreVersionDto,
  UpdateProjectDto,
} from './dto/save-project.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { UploadService } from 'src/upload/upload.service';
import {
  CardProjectHistoryDto,
  ProjectCardDto,
  SafeProjectDto,
} from './dto/safe-project.dto';

@ApiTags('Project')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth()
@Controller('project')
export class ProjectController {
  constructor(
    private projectService: ProjectService,
    private uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: 'Get all projects of current user' })
  @ApiOkResponse({
    type: ProjectCardDto,
    isArray: true,
  })
  @Get()
  async getUserProjects(@CurrentUser('sub') userId: number) {
    return await this.projectService.getUserProjects(userId);
  }

  @ApiOperation({ summary: 'Get all templates (system + own)' })
  @ApiOkResponse({ type: ProjectCardDto, isArray: true })
  @Get('templates')
  async getTemplates(@CurrentUser('sub') userId: number) {
    return await this.projectService.getTemplates(userId);
  }

  @ApiOperation({ summary: 'Get project by id' })
  @ApiOkResponse({ type: SafeProjectDto })
  @ApiNotFoundResponse({ description: 'Project was not found' })
  @ApiForbiddenResponse({
    description: 'Access to this project for current user was denied',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the project',
    type: Number,
    example: 1,
  })
  @Get(':id')
  async getProject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
  ) {
    return await this.projectService.getProjectById(id, userId);
  }

  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', type: Number, description: 'Project id' })
  @ApiConsumes('multipart/form-data')
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeProjectDto })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async updateProject(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) projectId: number,
    @Body() dto: UpdateProjectDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const picture = await this.uploadService.uploadThumbnail(file);
      dto.thumbnailUrl = picture.url;
      dto.thumbnail_public_id = picture.public_id;
    }

    return await this.projectService.updateProject(projectId, dto, userId);
  }

  @ApiOperation({ summary: 'Create new project (optionally from template)' })
  @ApiConsumes('multipart/form-data')
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiForbiddenResponse({ description: 'No access to this template' })
  @ApiOkResponse({ type: SafeProjectDto })
  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async createNewProject(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateProjectDto,
    @CurrentUser('sub') userId: number,
  ) {
    if (file) {
      const picture = await this.uploadService.uploadThumbnail(file);
      dto.thumbnailUrl = picture.url;
      dto.thumbnail_public_id = picture.public_id;
    }

    return await this.projectService.createProject(dto, userId);
  }

  @ApiOperation({ summary: 'Get project version history' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: CardProjectHistoryDto, isArray: true })
  @Get(':id/version')
  async getAllVersionsOfProject(
    @Param('id', ParseIntPipe) projectId: number,
    @CurrentUser('sub') userId: number,
  ) {
    return await this.projectService.getProjectHistory(projectId, userId);
  }

  @ApiOperation({ summary: 'Restore past version of project' })
  @ApiBody({
    type: RestoreVersionDto,
  })
  @ApiNotFoundResponse({
    description: 'History version not found or Project not found',
  })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeProjectDto })
  @Patch(':id/restore-version')
  async restoreVersion(
    @Param('id', ParseIntPipe) projectId: number,
    @CurrentUser('sub') userId: number,
    @Body() dto: RestoreVersionDto,
  ) {
    return await this.projectService.restoreVersion(
      projectId,
      dto.historyId,
      userId,
    );
  }
}
