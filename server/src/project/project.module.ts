import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { UserModule } from 'src/user/user.module';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [UserModule, UploadModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
