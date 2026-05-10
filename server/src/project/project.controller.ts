import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectDto, CreateProjectDtoD } from './dto/save-project.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { UploadService } from 'src/upload/upload.service';
import { ProjectCardDto, SafeProjectDto } from './dto/safe-project.dto';

@ApiTags('Project')
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
  @ApiBearerAuth()
  @Get()
  @UseGuards(JwtAccessGuard)
  async getUserProjects(@CurrentUser() user) {
    return await this.projectService.getUserProjects(user.id);
  }

  @ApiOperation({ summary: 'Get all templates (system + own)' })
  @ApiOkResponse({ type: ProjectCardDto, isArray: true })
  @ApiBearerAuth()
  @Get('templates')
  @UseGuards(JwtAccessGuard)
  async getTemplates(@CurrentUser() user) {
    console.log(user);
    return await this.projectService.getTemplates(user.id);
  }

  @ApiOperation({ summary: 'Get project by id' })
  @ApiOkResponse({ type: SafeProjectDto })
  @ApiNotFoundResponse({ description: 'Project was not found' })
  @ApiForbiddenResponse({
    description: 'Access to this project for current user was denied',
  })
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  async getProject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user) {
    return await this.projectService.getProjectById(id, user.id);
  }

  @ApiOperation({ summary: 'Create new project (optionally from template)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @Post('create')
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  async createNewProject(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user,
  ) {
    console.log(user.id);
    if (file) {
      const picture = await this.uploadService.uploadThumbnail(file);
      dto.thumbnailUrl = picture.url;
    }

    return await this.projectService.createProject(dto, user.id);
  }
}
