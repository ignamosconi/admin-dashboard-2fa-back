import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Admin2faSetupRequestDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  readonly pending_token!: string;
}