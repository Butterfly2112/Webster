import {
  Controller,
  Get,
  Patch,
  HttpCode,
  HttpStatus,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SafeUserDto } from 'src/auth/dto/auth-response.dto';
import { UpdateUserDto, UpdateUserDtoD } from 'src/user/dto/update-user-dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from 'src/upload/upload.service';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
    private uploadService: UploadService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOkResponse({ type: SafeUserDto })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  async getUserProfile(@CurrentUser('sub') id: number) {
    return await this.userService.getUserProfile(id);
  }

  @ApiOperation({ summary: 'Update username, email and/or avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({ type: UpdateUserDtoD })
  @ApiBadRequestResponse({ description: 'This email is already occupied' })
  @ApiForbiddenResponse({
    description:
      'Users logged in using gmail and not having password are forbidden to change email',
  })
  @ApiOkResponse({
    type: SafeUserDto,
    description:
      'User username or avatar were updated successfully. Request to change email (if there were one) was send',
  })
  @Patch('profile')
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  async updateProfile(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const result = await this.uploadService.uploadAvatar(file);
      dto.avatar_url = result.url;
      dto.avatar_public_id = result.public_id;
    }

    return await this.userService.updateUserProfile(userId, dto);
  }

  @ApiOperation({ summary: 'Confirm email change with token' })
  @ApiQuery({
    name: 'token',
    type: String,
    description: 'Token to confirm email change',
    required: true,
  })
  @ApiConflictResponse({ description: 'This email is already occupied' })
  @ApiBadRequestResponse({
    description: 'Invalid token or data about new email is missing',
  })
  @ApiOkResponse({ description: 'Email was changed successfully.' })
  @Patch('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    await this.userService.confirmEmailChange(token);
    return {
      message: 'Email was changed successfully.',
    };
  }
}
