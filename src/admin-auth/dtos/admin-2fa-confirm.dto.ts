import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Admin2faConfirmDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  readonly pending_token!: string;

  @ApiProperty({ example: '123456', description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  readonly totp_code!: string;
}