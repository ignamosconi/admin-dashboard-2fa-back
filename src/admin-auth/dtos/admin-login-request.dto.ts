import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginRequestDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'password_segura', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}