import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SafeUserDto } from 'src/auth/dto/auth-response.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

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
}
