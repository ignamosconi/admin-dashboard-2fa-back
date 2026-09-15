import {
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'admin2_editado', minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ example: 'nueva_password', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiProperty({
    example: 'password_actual_123',
    description: 'Contraseña actual para validar los cambios',
  })
  @IsNotEmpty({
    message: 'La contraseña actual es obligatoria para confirmar los cambios.',
  })
  @IsString()
  currentPassword!: string;
}
