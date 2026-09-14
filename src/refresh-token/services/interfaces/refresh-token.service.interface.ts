import { RefreshTokenEntity } from "src/refresh-token/entities/refresh-token.entity";
import { EntityManager } from 'typeorm';

export interface SaveRefreshTokenParams {
  token: string;
  sub: string;
  type: 'student' | 'admin';
  expiresIn: string;
  familyId?: string;
  sessionExpiresAt?: Date | null;
  clientId?: number;                // App OAuth asociada. Obligatorio cuando type === 'student', ausente cuando type === 'admin'.
}

export interface IRefreshTokenService {
  save(params: SaveRefreshTokenParams): Promise<void>;
  consume(token: string): Promise<RefreshTokenEntity>;
  revokeFamily(token: string): Promise<void>;
  revokeAllForSub(sub: string, manager?: EntityManager): Promise<void>;
  purgeExpired(): Promise<void>;
}