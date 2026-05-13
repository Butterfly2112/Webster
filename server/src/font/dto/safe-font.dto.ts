import { ApiProperty } from '@nestjs/swagger';

export class SafeFontDto {
  @ApiProperty({ description: 'Id of the font', example: 13 })
  id: number;

  @ApiProperty({ description: 'Name of the font', example: 'Times new custom' })
  name: string;

  @ApiProperty({
    description: 'URL of the font for download',
    example: 'https://newfonturl.com',
  })
  url: string;

  @ApiProperty({ description: 'Format of the font', example: 'font/woff' })
  format: string;

  @ApiProperty({
    description: 'Id of the owner of the font. Equals null if font is system',
  })
  owner_id: number | null;
}
