import { ApiProperty, OmitType } from '@nestjs/swagger';
import { JsonValue } from '@prisma/client/runtime/client';

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
}

export class ProjectCardDto extends OmitType(SafeProjectDto, [
  'canvasData',
  'createdAt',
]) {}
