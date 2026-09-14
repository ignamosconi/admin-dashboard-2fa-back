import { CreateAdminDto } from 'src/admin/dtos/create-admin.dto.js';
import { UpdateAdminDto } from 'src/admin/dtos/update-admin.dto.js';
import { AdminResponseDto } from 'src/admin/dtos/admin-response.dto';
import { AdminJwtPayloadDto } from 'src/admin-auth/dtos/admin-jwt-payload.dto';

interface RequestWithAdmin {
  admin: AdminJwtPayloadDto;
}

export interface IAdminController {
  findAll(): Promise<AdminResponseDto[]>;
  findOne(id: string): Promise<AdminResponseDto>;
  create(dto: CreateAdminDto): Promise<AdminResponseDto>;
  updateSelf(dto: UpdateAdminDto, req: RequestWithAdmin): Promise<AdminResponseDto>;
  remove(id: string): Promise<void>;
}