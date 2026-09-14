import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';

@Module({
    imports: [TypeOrmModule.forFeature([RefreshTokenEntity])],
    providers: [
        {
            provide: 'IRefreshTokenRepository',
            useClass: RefreshTokenRepository,
        },
        {
            provide: 'IRefreshTokenService',
            useClass: RefreshTokenService,
        },
    ],
    exports: ['IRefreshTokenService'],
})
export class RefreshTokenModule {}