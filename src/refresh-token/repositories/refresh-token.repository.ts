import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RefreshTokenEntity } from '../entities/refresh-token.entity.js';
import { IRefreshTokenRepository } from './interfaces/refresh-token.repository.interface.js';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repo: Repository<RefreshTokenEntity>,
  ) {}

  async save(token: Partial<RefreshTokenEntity>): Promise<RefreshTokenEntity> {
    return this.repo.save(token);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  // Abstraemos el QueryBuilder atómico acá
  async consumeToken(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const result = await this.repo
      .createQueryBuilder()
      .update(RefreshTokenEntity)
      .set({ used: true })
      .where('tokenHash = :tokenHash', { tokenHash })
      .andWhere('used = false')
      .andWhere('revoked = false')
      .returning('*')
      .execute();

    if (result.affected === 0) return null;

    const rawRecords = result.raw as RefreshTokenEntity[];
    return rawRecords[0] ?? null;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId }, { revoked: true });
  }

  async revokeAllForSub(sub: string, manager?: EntityManager): Promise<void> {
    const repo = manager
      ? manager.getRepository(RefreshTokenEntity)
      : this.repo;
    await repo.update({ sub, revoked: false }, { revoked: true });
  }

  async purgeExpired(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < :now', { now: new Date() })
      .execute();
  }
}