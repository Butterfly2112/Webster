import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FontService } from './font.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { SafeFontDto } from './dto/safe-font.dto';
import { UploadFontDto, UploadFontDtoD } from './dto/upload-font.dto';

@ApiTags('Font')
@ApiBearerAuth()
@Controller('font')
@UseGuards(JwtAccessGuard)
export class FontController {
  constructor(private fontService: FontService) {}

  @ApiOperation({ summary: 'Get all fonts (system + own)' })
  @ApiOkResponse({ type: SafeFontDto, isArray: true })
  @Get()
  async getAllFonts(@CurrentUser('sub') userId: number) {
    return await this.fontService.getFonts(userId);
  }

  @ApiOperation({ summary: 'Upload new font' })
  @ApiBody({ type: UploadFontDtoD })
  @ApiOkResponse({ type: SafeFontDto })
  @ApiBadRequestResponse({
    description:
      'File bigger than 5MB or Invalid file type. Only ttf, woff, woff2, and otf allowed',
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async uploadFont(
    @CurrentUser('sub') userId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFontDto,
  ) {
    return await this.fontService.uploadFont(userId, dto, file);
  }

  @ApiOperation({ summary: 'Get font by id' })
  @ApiParam({ type: Number, name: 'id', description: 'Font id', example: 13 })
  @ApiNotFoundResponse({ description: 'Font not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @ApiOkResponse({ type: SafeFontDto })
  @Get(':id')
  async getFont(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) fontId: number,
  ) {
    return await this.fontService.getFontById(userId, fontId);
  }

  @ApiOperation({ summary: 'Delete font by id' })
  @ApiParam({ type: Number, name: 'id', description: 'Font id', example: 13 })
  @ApiOkResponse({ description: 'Font was deleted successfully' })
  @ApiNotFoundResponse({ description: 'Font not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  @Delete(':id')
  async deleteFont(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) fontId: number,
  ) {
    await this.fontService.deleteFont(fontId, userId);

    return {
      message: 'Font was deleted successfully',
    };
  }
}
