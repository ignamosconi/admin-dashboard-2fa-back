import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  readonly pending_token!: string;

  @ApiProperty({ example: false, description: 'true = el admin nunca configuró 2FA y debe hacerlo ahora' })
  readonly requires_2fa_setup!: boolean;
}