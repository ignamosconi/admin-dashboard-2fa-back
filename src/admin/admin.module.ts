import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminEntity } from './entities/admin.entity.js';
import { AdminService } from './services/admin.service.js';
import { AdminRepository } from './repositories/admin.repository.js';
import { AdminController } from './controllers/admin.controller.js';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminEntity]),
    ConfigModule,
    JwtModule.register({}),
    RefreshTokenModule,
  ],
  controllers: [AdminController],
  providers: [
    {
      provide: 'IAdminRepository',
      useClass: AdminRepository,
    },
    {
      provide: 'IAdminService',
      useClass: AdminService,
    },
    AdminJwtGuard,
  ],
  exports: ['IAdminRepository', 'IAdminService'],
})
export class AdminModule {}