import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  readonly access_token!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  readonly refresh_token!: string;

  @ApiProperty({ example: 'Bearer' })
  readonly token_type!: string;

  @ApiProperty({ example: 900, description: 'Segundos hasta que expira el access token' })
  readonly expires_in!: number;
}