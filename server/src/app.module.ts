import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ErrorFilter } from './common/error.filter';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { UploadModule } from './upload/upload.module';
import { ProjectModule } from './project/project.module';
import { FontModule } from './font/font.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UserModule,
    EmailModule,
    UploadModule,
    ProjectModule,
    FontModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ErrorFilter,
    },
  ],
})
export class AppModule {}
