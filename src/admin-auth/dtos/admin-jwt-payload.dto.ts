import { ApiProperty } from '@nestjs/swagger';

export class AdminJwtPayloadDto {
  @ApiProperty({ example: 'uuid-del-admin' })
  readonly sub!: string;

  @ApiProperty({ example: 'admin' })
  readonly username!: string;

  @ApiProperty({ example: 'access' })
  readonly type!: string;
}