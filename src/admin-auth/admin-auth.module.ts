import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminEntity } from '../admin/entities/admin.entity.js';
import { AdminAuthService } from './services/admin-auth.service.js';
import { AdminAuthController } from './controllers/admin-auth.controller.js';
import { PendingChallengeService } from './services/pending-challenge.service.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminEntity]),
    ConfigModule,
    JwtModule.register({}),
    RefreshTokenModule,
  ],
  controllers: [AdminAuthController],
  providers: [
    {
      provide: 'IAdminAuthService',
      useClass: AdminAuthService,
    },
    {
      provide: 'IPendingChallengeService',
      useClass: PendingChallengeService,
    },
  ],
})
export class AdminAuthModule {}