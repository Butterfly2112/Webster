import {
  Body,
  Controller,
  Delete,
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
  ApiTags,
} from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectDto, CreateProjectDtoD } from './dto/save-project.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { UploadService } from 'src/upload/upload.service';
import {
  CardProjectHistoryDto,
  ProjectCardDto,
  SafeAssetDto,
  SafeProjectDto,
} from './dto/safe-project.dto';
import {
  RestoreVersionDto,
  UpdateProjectDto,
  UpdateProjectDtoD,
} from './dto/update-project.dto';

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

  @ApiOperation({
    summary: 'Get all templates (system + own)',
    description:
      'Returns array of templates. System templates first, then user templates',
  })
  @ApiOkResponse({ type: ProjectCardDto, isArray: true })
  @Get('templates')
  async getTemplates(@CurrentUser('sub') userId: number) {
    return await this.projectService.getTemplates(userId);
  }

  @ApiOperation({ summary: 'Create new project (optionally from template)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateProjectDtoD })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiForbiddenResponse({ description: 'No access to this template' })
  @ApiOkResponse({ type: SafeProjectDto })
  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async createNewProject(
    @Body() dto: CreateProjectDto,
    @CurrentUser('sub') userId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const picture = await this.uploadService.uploadThumbnail(file);
      dto.thumbnailUrl = picture.url;
      dto.thumbnail_public_id = picture.public_id;
    }

    return await this.projectService.createProject(dto, userId);
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
  @ApiBody({ type: UpdateProjectDtoD })
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

  @ApiOperation({ summary: 'Delete project and all its verions' })
  @ApiParam({ name: 'id', type: Number, description: 'Project id' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ description: 'Project was deleted successfully' })
  @Delete(':id')
  async deleteProject(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) projectId: number,
  ) {
    await this.projectService.deleteProject(projectId, userId);
    return {
      message: 'Project was deleted successfully',
    };
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

  @ApiOperation({ summary: 'Get project assets' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeAssetDto, isArray: true })
  @Get(':id/assets')
  async getProjectAssync(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) projectId: number,
  ) {
    return await this.projectService.getProjectAssets(projectId, userId);
  }

  @ApiOperation({ description: 'Upload new asset to project assets' })
  @ApiConsumes('multipart/form-data')
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeAssetDto })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/assets')
  async uploadAsset(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.projectService.uploadProjectAsset(
      projectId,
      userId,
      file,
    );
  }

  @ApiOperation({ description: 'Get asset by id' })
  @ApiNotFoundResponse({ description: 'Asset not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeAssetDto })
  @Get('assets/:id')
  async getAssetId(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) assetId: number,
  ) {
    return await this.projectService.getProjectAsset(assetId, userId);
  }

  @ApiOperation({ summary: 'Delete project asset' })
  @ApiParam({ name: 'id', type: Number, description: 'Asset id' })
  @ApiNotFoundResponse({ description: 'Asset not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ description: 'Asset deleted successfully' })
  @Delete('assets/:id')
  async deleteAsset(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) assetId: number,
  ) {
    await this.projectService.deleteProjectAsset(assetId, userId);
    return {
      message: 'Asset deleted successfully',
    };
  }
}
