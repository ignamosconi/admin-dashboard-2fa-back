import { CreateAdminDto } from '../dtos/create-admin.dto.js';
import { UpdateAdminDto } from '../dtos/update-admin.dto.js';
import { AdminResponseDto } from '../dtos/admin-response.dto.js';

export interface IAdminService {
  findAll(): Promise<AdminResponseDto[]>;
  findOne(id: string): Promise<AdminResponseDto>;
  create(dto: CreateAdminDto): Promise<AdminResponseDto>;
  updateSelf(id: string, dto: UpdateAdminDto): Promise<AdminResponseDto>;
  remove(id: string): Promise<void>;
}