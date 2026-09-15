import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';
import { RefreshTokenEntity } from '../entities/refresh-token.entity.js';
import { EntityManager } from 'typeorm';

function makeRecord(
  overrides: Partial<RefreshTokenEntity> = {},
): RefreshTokenEntity {
  return {
    id: 'uuid-test',
    tokenHash: 'hash-test',
    familyId: 'family-uuid',
    sub: 'admin-uuid',
    type: 'admin',
    used: false,
    revoked: false,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockRepo: jest.Mocked<Record<string, jest.Mock>>;

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn(),
      findByTokenHash: jest.fn(),
      consumeToken: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForSub: jest.fn(),
      purgeExpired: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: 'IRefreshTokenRepository',
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  describe('save', () => {
    it('debería guardar un nuevo refresh token con familia nueva', async () => {
      mockRepo.save.mockResolvedValue({});
      await service.save({
        token: 'plain-token',
        sub: 'user-1',
        type: 'student',
        expiresIn: '1d',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          type: 'student',
          tokenHash: expect.any(String),
          familyId: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('debería respetar el familyId si se pasa', async () => {
      mockRepo.save.mockResolvedValue({});
      await service.save({
        token: 'plain-token',
        sub: 'user-1',
        type: 'admin',
        expiresIn: '1d',
        familyId: 'existing-family',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'existing-family' }),
      );
    });
  });

  describe('consume', () => {
    it('debería marcar como usado y retornar el registro si el token es válido', async () => {
      const record = makeRecord();
      mockRepo.consumeToken.mockResolvedValue(record);

      const result = await service.consume('plain-token');
      expect(result).toEqual(record);
    });

    it('debería revocar la familia y lanzar UnauthorizedException si el token ya fue usado', async () => {
      mockRepo.consumeToken.mockResolvedValue(null);
      mockRepo.findByTokenHash.mockResolvedValue(makeRecord({ used: true }));
      mockRepo.revokeFamily.mockResolvedValue(undefined);

      await expect(service.consume('plain-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRepo.revokeFamily).toHaveBeenCalledWith('family-uuid');
    });

    it('debería lanzar UnauthorizedException si el token no existe', async () => {
      mockRepo.consumeToken.mockResolvedValue(null);
      mockRepo.findByTokenHash.mockResolvedValue(null);

      await expect(service.consume('plain-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debería lanzar UnauthorizedException y revocar si el token está expirado', async () => {
      const expiredRecord = makeRecord({
        expiresAt: new Date(Date.now() - 1000),
      });
      mockRepo.consumeToken.mockResolvedValue(expiredRecord);
      mockRepo.revokeFamily.mockResolvedValue(undefined);

      await expect(service.consume('plain-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRepo.revokeFamily).toHaveBeenCalledWith('family-uuid');
    });
  });

  describe('revokeFamily', () => {
    it('debería revocar toda la familia del token', async () => {
      mockRepo.findByTokenHash.mockResolvedValue(makeRecord());
      mockRepo.revokeFamily.mockResolvedValue(undefined);

      await service.revokeFamily('plain-token');

      expect(mockRepo.revokeFamily).toHaveBeenCalledWith('family-uuid');
    });

    it('no debería lanzar error si el token no existe', async () => {
      mockRepo.findByTokenHash.mockResolvedValue(null);
      await expect(
        service.revokeFamily('inexistente'),
      ).resolves.toBeUndefined();
    });
  });

  describe('revokeAllForSub', () => {
    it('debería revocar todos los tokens activos del sub', async () => {
      mockRepo.revokeAllForSub.mockResolvedValue(undefined);
      await service.revokeAllForSub('admin-uuid');
      expect(mockRepo.revokeAllForSub).toHaveBeenCalledWith(
        'admin-uuid',
        undefined,
      );
    });

    it('debería usar el manager externo si se pasa', async () => {
      const mockManager = {} as EntityManager;
      mockRepo.revokeAllForSub.mockResolvedValue(undefined);
      await service.revokeAllForSub('admin-uuid', mockManager);
      expect(mockRepo.revokeAllForSub).toHaveBeenCalledWith(
        'admin-uuid',
        mockManager,
      );
    });
  });
});
