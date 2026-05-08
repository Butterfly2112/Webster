import { BadRequestException, Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';
import 'multer';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg',
];

const ALLOWED_FONT_TYPES = [
  'font/ttf',
  'font/woff',
  'font/woff2',
  'font/otf',
  'application/octet-stream',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FONT_SIZE = 5 * 1024 * 1024;

@Injectable()
export class UploadService {
  private upload(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!);
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<{
    url: string;
    public_id: string;
    width: number;
    height: number;
  }> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, GIF allowed.',
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('File too large. Max 10MB.');
    }

    const result = await this.upload(file.buffer, 'webster/projects');
    return {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    };
  }

  async uploadThumbnail(file: Express.Multer.File): Promise<{ url: string }> {
    const result = await this.upload(file.buffer, 'webster/thumbnails');
    return { url: result.secure_url };
  }

  async uploadAvatar(
    file: Express.Multer.File,
  ): Promise<{ url: string; public_id: string }> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type.');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('File too large. Max 10MB.');
    }

    const result = await this.upload(file.buffer, 'webster/avatars');
    return { url: result.secure_url, public_id: result.public_id };
  }

  async uploadFont(
    file: Express.Multer.File,
  ): Promise<{ url: string; public_id: string }> {
    if (file.size > MAX_FONT_SIZE) {
      throw new BadRequestException('Font file too large. Max 5MB.');
    }

    const result = await this.upload(file.buffer, 'webster/fonts', 'raw');
    return { url: result.secure_url, public_id: result.public_id };
  }

  async deleteFile(
    public_id: string,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(public_id, {
      resource_type: resourceType,
    });
  }
}
