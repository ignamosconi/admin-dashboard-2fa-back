import { ApiProperty } from '@nestjs/swagger';

export class AdminResponseDto {

  @ApiProperty({ example: 'uuid-del-admin' })
  readonly id!: string;

  @ApiProperty({ example: 'admin' })
  readonly username!: string;

  @ApiProperty()
  readonly createdAt!: Date;

  @ApiProperty()
  readonly updatedAt!: Date;
}