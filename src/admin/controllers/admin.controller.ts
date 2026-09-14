import { Controller, Get, Post, Patch, Delete, Body, Param, Inject, UseGuards, ParseUUIDPipe, Request } from '@nestjs/common';
import { AdminJwtPayloadDto } from '../../admin-auth/dtos/admin-jwt-payload.dto.js';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IAdminController } from './interfaces/admin.controller.interface.js';
import type { IAdminService } from '../services/interfaces/admin.service.interface.js';
import { CreateAdminDto } from '../dtos/create-admin.dto.js';
import { UpdateAdminDto } from '../dtos/update-admin.dto.js';
import { AdminResponseDto } from '../dtos/admin-response.dto.js';
import { AdminJwtGuard } from '../../admin-auth/guards/admin-jwt.guard.js';

interface RequestWithAdmin {
  admin: AdminJwtPayloadDto;
}


@ApiTags('Admin — Gestión de administradores')
@ApiBearerAuth('admin-jwt')
@UseGuards(AdminJwtGuard)
@Controller('admin/admins')
export class AdminController implements IAdminController {
  constructor(
    @Inject('IAdminService')
    private readonly adminService: IAdminService,
  ) {}

  @ApiOperation({ summary: 'Listar todos los administradores' })
  @ApiResponse({ status: 200, type: [AdminResponseDto] })
  @Get()
  findAll(): Promise<AdminResponseDto[]> {
    return this.adminService.findAll();
  }

  @ApiOperation({ summary: 'Obtener administrador por ID' })
  @ApiResponse({ status: 200, type: AdminResponseDto })
  @ApiResponse({ status: 404, description: 'Admin no encontrado' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminResponseDto> {
    return this.adminService.findOne(id);
  }

  @ApiOperation({ summary: 'Crear nuevo administrador' })
  @ApiResponse({ status: 201, type: AdminResponseDto })
  @ApiResponse({ status: 409, description: 'Username ya en uso' })
  @Post()
  create(@Body() dto: CreateAdminDto): Promise<AdminResponseDto> {
    return this.adminService.create(dto);
  }

  @ApiOperation({
    summary: 'Actualizar propio usuario',
    description: 'Un admin solo puede editar su propio usuario y contraseña.',
  })
  @ApiResponse({ status: 200, type: AdminResponseDto })
  @ApiResponse({ status: 404, description: 'Admin no encontrado' })
  @Patch('me')
  updateSelf(@Body() dto: UpdateAdminDto, @Request() req: RequestWithAdmin): Promise<AdminResponseDto> {
    return this.adminService.updateSelf(req.admin.sub, dto);
  }

  @ApiOperation({ summary: 'Eliminar administrador' })
  @ApiResponse({ status: 200, description: 'Admin eliminado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar el último admin' })
  @ApiResponse({ status: 404, description: 'Admin no encontrado' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adminService.remove(id);
  }
}