import { ApiProperty, OmitType } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';

export class SafeProjectDto {
  @ApiProperty({ description: 'Id of the project', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Title of the project',
    example: 'Event ticket',
  })
  title: string;

  @ApiProperty({
    description: 'Description of the project',
    example: 'The design of the secret event. First version',
  })
  description?: string;

  @ApiProperty({
    description: 'Json object containing all canvas information',
    required: false,
  })
  canvasData: object;

  @ApiProperty({
    description: 'The width of the project ',
    required: false,
    default: 800,
  })
  width: number;

  @ApiProperty({
    description: 'The height of the project ',
    required: false,
    default: 600,
  })
  height: number;

  @ApiProperty({
    description: 'The current thumbnail of the project',
  })
  thumbnailUrl?: string;

  @ApiProperty({
    description: 'Defines if this project is a template',
  })
  isTemplate: boolean;

  @ApiProperty({
    description: 'When project was created',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When project was last updated',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Id of the owner of project',
  })
  ownerId?: number | null;

  @ApiProperty({
    description: 'Assets of the project',
    type: () => SafeAssetDto,
    isArray: true,
  })
  assets?: SafeAssetDto[];
}

export class ProjectCardDto extends OmitType(SafeProjectDto, [
  'canvasData',
  'createdAt',
  'assets',
]) {}

export class ProjectHistoryDto {
  @ApiProperty({ description: 'Id of the version', example: 2 })
  id: number;

  @ApiProperty({ description: 'Version number', example: 4 })
  version: number;

  @ApiProperty({
    description: 'Thumbnail image of the version',
    example: 'https://example.com/image',
  })
  thumbnail_url: string | null;

  @ApiProperty({
    description:
      'Json object containing all canvas information of current version',
  })
  canvas_data?: object;

  @ApiProperty({ description: 'Date when this version were created' })
  created_at: Date;
}

export class CardProjectHistoryDto extends OmitType(ProjectHistoryDto, [
  'canvas_data',
]) {}

export class SafeAssetDto {
  @ApiProperty({ description: 'Id of the asset', example: 67 })
  id: number;

  @ApiProperty({ description: 'Type of asset', enum: AssetType })
  type: AssetType;

  @ApiProperty({
    description: 'Url of the image',
    example: 'https://example.com/webster/assets/applepie',
  })
  url: string;

  @ApiProperty({ description: 'Original name of photo', example: 'Apple pie' })
  original_name: string;

  @ApiProperty({ description: 'File size of the image', example: 1282758 })
  file_size: number;

  @ApiProperty({
    description: 'Id of the project asset belongs to',
    example: 2,
  })
  project_id?: number;
}
