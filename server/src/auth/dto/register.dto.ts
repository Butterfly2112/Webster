import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Login can only contain letters, numbers, _ and -',
  })
  login: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsEmail({}, { message: 'Invalid email' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and number',
  })
  password: string;
}

export class RequestPasswordResetDto extends PickType(RegisterDto, ['email']) {}

export class PasswordChangeDto extends PickType(RegisterDto, ['password']) {
  @ApiProperty({ example: 'eyJhbGci...' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
