import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { RefreshTokenEntity } from '../entities/refresh-token.entity.js';
import {
  IRefreshTokenService,
  SaveRefreshTokenParams,
} from './interfaces/refresh-token.service.interface.js';
import type { IRefreshTokenRepository } from '../repositories/interfaces/refresh-token.repository.interface.js';

@Injectable()
export class RefreshTokenService implements IRefreshTokenService {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly repo: IRefreshTokenRepository,
  ) {}

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toDate(expiresIn: string): Date {
    const unit = expiresIn.slice(-1);
    const amount = parseInt(expiresIn.slice(0, -1), 10);
    const ms =
      unit === 's'
        ? amount * 1000
        : unit === 'm'
          ? amount * 60 * 1000
          : unit === 'h'
            ? amount * 60 * 60 * 1000
            : unit === 'd'
              ? amount * 60 * 60 * 24 * 1000
              : parseInt(expiresIn, 10) * 1000;
    return new Date(Date.now() + ms);
  }

  async save(params: SaveRefreshTokenParams): Promise<void> {
    await this.repo.save({
      tokenHash: this.hash(params.token),
      familyId: params.familyId ?? randomUUID(),
      sub: params.sub,
      type: params.type,
      expiresAt: this.toDate(params.expiresIn),
      sessionExpiresAt: params.sessionExpiresAt ?? null,
    });
  }

  async consume(token: string): Promise<RefreshTokenEntity> {
    const tokenHash = this.hash(token);
    const record = await this.repo.consumeToken(tokenHash);

    if (!record) {
      const existing = await this.repo.findByTokenHash(tokenHash);
      if (existing?.used) {
        await this.repo.revokeFamily(existing.familyId);
        throw new UnauthorizedException(
          'Refresh token ya utilizado. Sesión revocada por seguridad.',
        );
      }
      throw new UnauthorizedException('Refresh token inválido o revocado.');
    }

    const now = new Date();
    if (new Date(record.expiresAt) < now) {
      await this.repo.revokeFamily(record.familyId);
      throw new UnauthorizedException('Refresh token expirado.');
    }

    if (record.sessionExpiresAt && new Date(record.sessionExpiresAt) < now) {
      await this.repo.revokeFamily(record.familyId);
      throw new UnauthorizedException(
        'La sesión expiró. Volvé a iniciar sesión.',
      );
    }

    return record;
  }

  async revokeFamily(token: string): Promise<void> {
    const tokenHash = this.hash(token);
    const record = await this.repo.findByTokenHash(tokenHash);
    if (!record) return;
    await this.repo.revokeFamily(record.familyId);
  }

  async revokeAllForSub(sub: string, manager?: EntityManager): Promise<void> {
    await this.repo.revokeAllForSub(sub, manager);
  }

  async purgeExpired(): Promise<void> {
    await this.repo.purgeExpired();
  }
}
