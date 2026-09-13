import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Admin2faResetDto {
  @ApiProperty({
    example: 'mi_password_actual',
    description: 'Password actual del admin. Requerida para confirmar la identidad antes de resetear el 2FA.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password!: string;
}