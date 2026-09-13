import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLogoutRequestDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  readonly refresh_token!: string;
}