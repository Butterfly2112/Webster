import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import bcrypt from 'bcrypt';
import { TokenType, User } from '@prisma/client';
import { SafeUserDto } from 'src/auth/dto/auth-response.dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { UploadService } from 'src/upload/upload.service';
import { EmailService } from 'src/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private emailService: EmailService,
  ) {}

  async create(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ login: dto.login }, { email: dto.email }] },
      select: { login: true, email: true },
    });

    if (existing?.login === dto.login) {
      throw new ConflictException('Login already taken');
    }
    if (existing?.email === dto.email) {
      throw new ConflictException('Email already taken');
    }

    const password_hash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user
      .create({
        data: {
          login: dto.login,
          username: dto.username,
          email: dto.email,
          password_hash,
        },
      })
      .catch((e) => {
        if (e.code === 'P2002')
          throw new ConflictException('Credentials taken');
        throw e;
      });
  }

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    const password_hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: password_hash },
    });
  }

  async findByloginOrEmail(loginOrEmail: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ login: loginOrEmail }, { email: loginOrEmail }] },
    });
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { google_id: googleId },
    });
  }

  async findById(userId: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createGoogleUser(data: {
    login: string;
    username: string;
    email: string;
    googleId: string;
    avatar: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        login: data.login,
        username: data.username,
        email: data.email,
        google_id: data.googleId,
        avatar_url: data.avatar,
        is_email_verified: true,
      },
    });
  }

  async getUserProfile(userId: number): Promise<SafeUserDto> {
    const user = await this.findById(userId);

    return {
      id: user.id,
      login: user.login,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    };
  }

  async updateUserProfile(
    userId: number,
    dto: UpdateUserDto,
  ): Promise<SafeUserDto> {
    const user = await this.findById(userId);
    const updateData: any = {};

    if (dto.username && dto.username !== user.username) {
      updateData.username = dto.username;
    }

    if (dto.avatar_public_id) {
      if (user.avatar_public_id)
        await this.safeDeleteFile(user.avatar_public_id);
      updateData.avatar_url = dto.avatar_url;
      updateData.avatar_public_id = dto.avatar_public_id;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    if (dto.email && dto.email !== user.email) {
      if (user.google_id && !user.password_hash) {
        throw new ForbiddenException(
          'Users logged in using gmail and not having password are forbidden to change email',
        );
      }

      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (emailTaken) {
        throw new ConflictException('This email is already occupied');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

      await this.prisma.token.create({
        data: {
          type: TokenType.emailChange,
          token,
          new_email: dto.email,
          expires_at: expiresAt,
          user_id: userId,
        },
      });

      await this.emailService.sendEmailChangeRequest(
        dto.username || user.username,
        dto.email,
        token,
      );
    }

    return this.getUserProfile(userId);
  }

  async confirmEmailChange(token: string): Promise<void> {
    const tokenRecord = await this.prisma.token.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.type !== TokenType.emailChange) {
      throw new BadRequestException('Invalid token');
    }

    if (tokenRecord.expires_at && tokenRecord.expires_at < new Date()) {
      await this.prisma.token.delete({ where: { id: tokenRecord.id } });
      throw new BadRequestException('Token has expired');
    }

    if (!tokenRecord.new_email) {
      throw new BadRequestException('The data about new email is missing');
    }

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: tokenRecord.new_email },
    });

    if (emailTaken) {
      await this.prisma.token.delete({ where: { id: tokenRecord.id } });
      throw new ConflictException('This email is already occupied');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: tokenRecord.user_id },
      data: {
        email: tokenRecord.new_email,
        is_email_verified: true,
      },
    });

    await this.prisma.token.delete({ where: { id: tokenRecord.id } });
  }

  private async safeDeleteFile(
    public_id: string | null | undefined,
  ): Promise<void> {
    if (!public_id) return;
    try {
      await this.uploadService.deleteFile(public_id);
    } catch {
      console.warn(`Failed to delete Cloudinary file: ${public_id}`);
    }
  }
}
