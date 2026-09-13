jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminEntity } from '../../admin/entities/admin.entity.js';
import * as bcrypt from 'bcrypt';

const TOTP_KEY = 'b'.repeat(64);
const ACCESS_SECRET = 'access-secret';
const REFRESH_SECRET = 'refresh-secret';

function makeAdmin(overrides: Partial<AdminEntity> = {}): AdminEntity {
  return {
    id: 'admin-uuid',
    username: 'admin',
    password: '$2b$12$placeholder',
    totpSecret: null,
    totpEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AdminAuthService', () => {
  let service: AdminAuthService;

  let mockRepo: jest.Mocked<Record<string, jest.Mock>>;
  let mockJwtService: jest.Mocked<Partial<JwtService>>;
  let mockRefreshTokenService: jest.Mocked<Record<string, jest.Mock>>;
  let mockPendingChallengeService: jest.Mocked<Record<string, jest.Mock>>;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };

    mockRefreshTokenService = {
      save: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn(),
      revokeFamily: jest.fn().mockResolvedValue(undefined),
    };

    // Mock del PendingChallengeService — simula Redis sin necesitar conexión real.
    // create: registra el challenge exitosamente.
    // verify: valida el challenge exitosamente (no lanza).
    // consume: consume el challenge exitosamente (no lanza).
    // recordAttempt: por defecto simula código correcto.
    mockPendingChallengeService = {
      create: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue({ adminId: 'admin-uuid' }),
      consume: jest.fn().mockResolvedValue({ adminId: 'admin-uuid' }),
      recordAttempt: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: getRepositoryToken(AdminEntity), useValue: mockRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: 'IRefreshTokenService', useValue: mockRefreshTokenService },
        { provide: 'IPendingChallengeService', useValue: mockPendingChallengeService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                JWT_ADMIN_ACCESS_SECRET: ACCESS_SECRET,
                JWT_ADMIN_REFRESH_SECRET: REFRESH_SECRET,
                JWT_ADMIN_ACCESS_EXPIRES_IN: '15m',
                JWT_ADMIN_REFRESH_EXPIRES_IN: '1d',
                TOTP_ENCRYPTION_KEY: TOTP_KEY,
                PENDING_2FA_TTL_MS: '180000',
              };
              if (key in map) return map[key];
              throw new Error(`Config key not found: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  describe('login', () => {
    it('debería retornar pending_token con requires_2fa_setup=true si el admin no tiene 2FA', async () => {
      const admin = makeAdmin();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRepo.findOne.mockResolvedValue(admin);

      const result = await service.login({ username: 'admin', password: 'password123' });

      expect(result.pending_token).toBeDefined();
      expect(result.requires_2fa_setup).toBe(true);
    });

    it('debería retornar requires_2fa_setup=false si el admin ya tiene 2FA activo', async () => {
      const admin = makeAdmin({ totpEnabled: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRepo.findOne.mockResolvedValue(admin);

      const result = await service.login({ username: 'admin', password: 'password123' });

      expect(result.requires_2fa_setup).toBe(false);
    });

    it('debería lanzar UnauthorizedException con credenciales inválidas', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ username: 'admin', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la password no coincide', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ username: 'admin', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('debería revocar la familia del refresh token', async () => {
      await service.logout({ refresh_token: 'some-refresh-token' });
      expect(mockRefreshTokenService.revokeFamily).toHaveBeenCalledWith('some-refresh-token');
    });
  });

  describe('validate2fa', () => {
    it('debería lanzar UnauthorizedException si el pending token es inválido', async () => {
      mockJwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('invalid'));
      await expect(service.validate2fa({ pending_token: 'bad', totp_code: '123456' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si el admin no tiene 2FA configurado', async () => {
      mockJwtService.verifyAsync = jest.fn().mockResolvedValue({
        sub: 'admin-uuid',
        jti: 'test-jti',
        purpose: '2fa-confirm',
        type: 'pending-2fa',
      });
      mockRepo.findOne.mockResolvedValue(makeAdmin({ totpEnabled: false }));

      await expect(service.validate2fa({ pending_token: 'valid', totp_code: '123456' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});