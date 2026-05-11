import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'New username',
    example: 'new_login_2026',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiProperty({
    description: 'New email to request email change',
    example: 'mosquito@example.com',
  })
  @IsOptional()
  email?: string;

  @IsOptional()
  avatar_url?: string;

  @IsOptional()
  avatar_public_id?: string;
}

export class UpdateUserDtoD extends OmitType(UpdateUserDto, [
  'avatar_public_id',
  'avatar_url',
]) {
  @ApiProperty({
    description: 'New avatar',
  })
  @IsOptional()
  file?: string;
}
