import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/upload/upload.service';
import { SafeFontDto } from './dto/safe-font.dto';
import { Font } from '@prisma/client';
import { UploadFontDto } from './dto/upload-font.dto';

@Injectable()
export class FontService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async getFonts(userId: number): Promise<SafeFontDto[]> {
    const fonts = await this.prisma.font.findMany({
      where: { OR: [{ owner_id: null }, { owner_id: userId }] },
      orderBy: [{ owner_id: 'asc' }, { name: 'asc' }],
    });

    return fonts.map(this.toSafeFont);
  }

  async getFontById(userId: number, fontId: number): Promise<SafeFontDto> {
    const font = await this.prisma.font.findUnique({ where: { id: fontId } });

    if (!font) {
      throw new NotFoundException('Font not found');
    }
    const isSystemFont = font.owner_id === null;
    const isOwnFont = font.owner_id === userId;

    if (!isSystemFont && !isOwnFont) {
      throw new ForbiddenException('Access denied');
    }

    return this.toSafeFont(font);
  }

  async uploadFont(
    userId: number,
    dto: UploadFontDto,
    file: Express.Multer.File,
  ): Promise<SafeFontDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const uploaded_font = await this.uploadService.uploadFont(file);

    const font = await this.prisma.font.create({
      data: {
        name: dto.name,
        url: uploaded_font.url,
        public_id: uploaded_font.public_id,
        format: this.detectFontFormat(file),
        owner_id: userId,
      },
    });

    return this.toSafeFont(font);
  }

  async deleteFont(fontId: number, userId: number): Promise<void> {
    const font = await this.prisma.font.findUnique({ where: { id: fontId } });

    if (!font) {
      throw new NotFoundException('Font not found');
    }
    if (font.owner_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    try {
      await this.uploadService.deleteFile(font.public_id, 'raw');
    } catch {
      console.warn(`Failed to delete font from Cloudinary: ${font.public_id}`);
    }

    await this.prisma.font.delete({ where: { id: fontId } });
  }

  private detectFontFormat(file: Express.Multer.File): string {
    const mime = file.mimetype;
    const name = file.originalname.toLowerCase();

    if (mime === 'font/ttf' || name.endsWith('.ttf')) return 'truetype';
    if (mime === 'font/woff' || name.endsWith('.woff')) return 'woff';
    if (mime === 'font/woff2' || name.endsWith('.woff2')) return 'woff2';
    if (mime === 'font/otf' || name.endsWith('.otf')) return 'opentype';

    return 'truetype';
  }

  private toSafeFont(font: Font): SafeFontDto {
    return {
      id: font.id,
      name: font.name,
      url: font.url,
      format: font.format,
      owner_id: font.owner_id,
    };
  }
}
