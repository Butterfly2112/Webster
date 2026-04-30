import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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
}
