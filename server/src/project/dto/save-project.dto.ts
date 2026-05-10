import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsJSON,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Title of the project',
    example: 'Event ticket',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Description of the project',
    example: 'The design of the secret event. First version',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Json object containing all canvas information',
    required: false,
  })
  @IsObject()
  @IsOptional()
  canvasData?: object;

  @ApiProperty({
    description: 'The width of the project ',
    required: false,
    default: 800,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  width?: number;

  @ApiProperty({
    description: 'The height of the project ',
    required: false,
    default: 600,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  height?: number;

  @IsOptional()
  thumbnailUrl?: string;

  @ApiProperty({
    description: 'The id of the template from which project being created.',
    required: false,
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  sourceTemplateId?: number;
}

export class UpdateProjectDto extends OmitType(CreateProjectDto, ['title']) {
  @IsOptional()
  title?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isTemplate?: boolean;
}

export class CreateProjectDtoD extends OmitType(CreateProjectDto, [
  'thumbnailUrl',
]) {
  @ApiProperty({
    description: 'The current thumbnail of the project',
  })
  @IsOptional()
  file?: string;
}

export class UpdateProjectDtoD extends OmitType(UpdateProjectDto, [
  'thumbnailUrl',
]) {
  @ApiProperty({
    description: 'The current thumbnail of the project',
  })
  @IsOptional()
  file?: string;
}
