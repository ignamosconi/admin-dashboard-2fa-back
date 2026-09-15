import { CreateAdminDto } from 'src/admin/dtos/create-admin.dto.js';
import { UpdateAdminDto } from 'src/admin/dtos/update-admin.dto';
import { AdminResponseDto } from 'src/admin/dtos/admin-response.dto';

export interface IAdminService {
  findAll(): Promise<AdminResponseDto[]>;
  findOne(id: string): Promise<AdminResponseDto>;
  create(dto: CreateAdminDto): Promise<AdminResponseDto>;
  updateSelf(id: string, dto: UpdateAdminDto): Promise<AdminResponseDto>;
  remove(id: string): Promise<void>;
}
