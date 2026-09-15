import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IAdminService } from './interfaces/admin.service.interface.js';
import type { IAdminRepository } from '../repositories/interfaces/admin.repository.interface.js';
import type { IRefreshTokenService } from 'src/refresh-token/services/interfaces/refresh-token.service.interface.js';
import { AdminEntity } from '../entities/admin.entity.js';
import { CreateAdminDto } from '../dtos/create-admin.dto.js';
import { UpdateAdminDto } from '../dtos/update-admin.dto.js';
import { AdminResponseDto } from '../dtos/admin-response.dto.js';

@Injectable()
export class AdminService implements IAdminService {
  constructor(
    @Inject('IAdminRepository')
    private readonly adminRepository: IAdminRepository,
    @Inject('IRefreshTokenService')
    private readonly refreshTokenService: IRefreshTokenService,
  ) {}

  private toDto(entity: AdminEntity): AdminResponseDto {
    return {
      id: entity.id,
      username: entity.username,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async findAll(): Promise<AdminResponseDto[]> {
    const admins = await this.adminRepository.findAll();
    return admins.map(a => this.toDto(a));
  }

  async findOne(id: string): Promise<AdminResponseDto> {
    const admin = await this.adminRepository.findById(id);
    if (!admin) throw new NotFoundException(`Admin con id ${id} no encontrado.`);
    return this.toDto(admin);
  }

  async create(dto: CreateAdminDto): Promise<AdminResponseDto> {
    const exists = await this.adminRepository.findByUsername(dto.username);
    if (exists) throw new ConflictException(`El username "${dto.username}" ya está en uso.`);
    const hashed = await bcrypt.hash(dto.password, 12);
    return this.toDto(await this.adminRepository.save({ username: dto.username, password: hashed }));
  }

  async updateSelf(id: string, dto: UpdateAdminDto): Promise<AdminResponseDto> {
    const admin = await this.adminRepository.findById(id);
    if (!admin) throw new NotFoundException(`Admin con id ${id} no encontrado.`);

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, admin.password);
    if (!isPasswordValid) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }

    if (dto.username && dto.username !== admin.username) {
      const exists = await this.adminRepository.findByUsername(dto.username);
      if (exists) throw new ConflictException(`El username "${dto.username}" ya está en uso.`);
      admin.username = dto.username;
    }

    if (dto.password) {
      admin.password = await bcrypt.hash(dto.password, 12);
    }

    return this.toDto(await this.adminRepository.save(admin));
  }

  async remove(id: string): Promise<void> {
    const admin = await this.adminRepository.findById(id);
    if (!admin) throw new NotFoundException(`Admin con id ${id} no encontrado.`);
    const total = await this.adminRepository.count();
    if (total <= 1) throw new BadRequestException('No se puede eliminar el último administrador del sistema.');
    
    await this.adminRepository.transaction(async (manager) => {
      await this.refreshTokenService.revokeAllForSub(id, manager);
      await this.adminRepository.remove(admin, manager);
    });
  }
}