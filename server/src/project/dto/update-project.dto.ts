import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateProjectDto } from './save-project.dto';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProjectDto extends OmitType(CreateProjectDto, ['title']) {
  @ApiProperty({
    description: 'Title of the project',
    example: 'Event ticket',
  })
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Defines if project is template or not',
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isTemplate?: boolean;
}

export class UpdateProjectDtoD extends OmitType(UpdateProjectDto, [
  'thumbnailUrl',
  'thumbnail_public_id',
]) {
  @ApiProperty({
    description: 'The current thumbnail of the project',
  })
  @IsOptional()
  file?: string;
}

export class RestoreVersionDto {
  @ApiProperty({
    description: 'Version Id of the project which needs to be restored',
    example: 12,
  })
  @IsInt()
  historyId: number;
}
