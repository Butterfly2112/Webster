import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  PasswordChangeDto,
  RegisterDto,
  RequestPasswordResetDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { type Response, type Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LoginResponseDto } from './dto/auth-response.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleGuard } from './guards/google.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  @ApiConflictResponse({ description: 'Login or email already taken' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return {
      message:
        'Registered successfully, please chech your email box to confirm your email.',
    };
  }

  @Post('confirm-email')
  @ApiOperation({ summary: 'Confirm email with token from email' })
  @ApiOkResponse({ description: 'Email confirmed successfully' })
  @ApiConflictResponse({ description: 'Invalid token' })
  @HttpCode(HttpStatus.OK)
  async confirmEmail(@Query('token') token: string) {
    await this.authService.confirmEmail(token);
    return {
      message: 'Confirmed email successfully. Please, proceed to login.',
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with login/email and password' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid credentials' })
  @ApiForbiddenResponse({ description: 'Email not verified' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current device' })
  @ApiOkResponse({ description: '' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.refreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });

    return { message: 'Logged out successfully' };
  }

  @Get('google')
  @UseGuards(GoogleGuard)
  @ApiOperation({ summary: 'Login or register via Google' })
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const frontendUrl =
      this.configService.get('FRONTEND_URL') ?? 'http://localhost:3001';

    try {
      const { accessToken, refreshToken } =
        await this.authService.loginWithGoogle(req.user);

      this.setRefreshCookie(res, refreshToken);
      res.redirect(`${frontendUrl}/login?token=${accessToken}`);
    } catch (error: any) {
      const message = encodeURIComponent(error.message ?? 'Auth error');
      res.redirect(`${frontendUrl}/login?error=${message}`);
    }
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  @ApiCookieAuth('refreshToken')
  @ApiOkResponse({ type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser('sub') userId: number,
    @CurrentUser('tokenId') tokenId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { accessToken, refreshToken, user } = await this.authService.refresh(
      userId,
      tokenId,
    );
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken, user };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }

  @Post('reset-password-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiOkResponse({
    description:
      'Password reset request were made successfully. Link with reset token were sent on the email',
  })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiNotFoundResponse({ description: 'User with such email not found' })
  async resetPasswordRequest(@Body() dto: RequestPasswordResetDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message: 'Please check your email box',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Password reset' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  @ApiBody({ type: PasswordChangeDto })
  @ApiNotFoundResponse({ description: 'Token was not found in the database' })
  @ApiForbiddenResponse({ description: 'Reset Token has expired' })
  async resetPassword(@Body() dto: PasswordChangeDto) {
    await this.authService.passwordChange(dto.token, dto.password);
    return {
      message: 'Password reset successfully. Please proceed to login',
    };
  }
}
