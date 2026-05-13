import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UploadFontDto {
  @ApiProperty({ description: 'Name of the font', example: 'Times new custom' })
  @IsString()
  @MinLength(1)
  name: string;
}

export class UploadFontDtoD extends UploadFontDto {
  @ApiProperty({ description: 'File of the font to be uploaded' })
  file: string;
}
