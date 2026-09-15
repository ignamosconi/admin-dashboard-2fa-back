import { EntityManager } from 'typeorm';
import { RefreshTokenEntity } from '../../entities/refresh-token.entity.js';

export interface IRefreshTokenRepository {
  save(token: Partial<RefreshTokenEntity>): Promise<RefreshTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  consumeToken(tokenHash: string): Promise<RefreshTokenEntity | null>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForSub(sub: string, manager?: EntityManager): Promise<void>;
  purgeExpired(): Promise<void>;
}
