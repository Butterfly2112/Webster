import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { CloudinaryProvider } from './upload.provider';

@Module({
  providers: [UploadService, CloudinaryProvider],
  controllers: [UploadController],
})
export class UploadModule {}
