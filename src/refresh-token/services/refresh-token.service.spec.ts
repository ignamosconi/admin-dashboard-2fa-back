import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';
import { RefreshTokenEntity } from '../entities/refresh-token.entity.js';
import { EntityManager } from 'typeorm';

// Helper para construir un registro de refresh token falso
function makeRecord(overrides: Partial<RefreshTokenEntity> = {}): RefreshTokenEntity {
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
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshTokenEntity),
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
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1, raw: [record] }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.consume('plain-token');
      expect(result).toEqual(record);
    });

    it('debería revocar la familia y lanzar UnauthorizedException si el token ya fue usado', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      mockRepo.findOne.mockResolvedValue(makeRecord({ used: true }));
      mockRepo.update.mockResolvedValue({});

      await expect(service.consume('plain-token')).rejects.toThrow(UnauthorizedException);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { familyId: 'family-uuid' },
        { revoked: true },
      );
    });

    it('debería lanzar UnauthorizedException si el token no existe', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.consume('plain-token')).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException y revocar si el token está expirado', async () => {
      const expiredRecord = makeRecord({ expiresAt: new Date(Date.now() - 1000) });
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1, raw: [expiredRecord] }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      mockRepo.update.mockResolvedValue({});

      await expect(service.consume('plain-token')).rejects.toThrow(UnauthorizedException);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { familyId: 'family-uuid' },
        { revoked: true },
      );
    });
  });

  describe('revokeFamily', () => {
    it('debería revocar toda la familia del token', async () => {
      mockRepo.findOne.mockResolvedValue(makeRecord());
      mockRepo.update.mockResolvedValue({});

      await service.revokeFamily('plain-token');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { familyId: 'family-uuid' },
        { revoked: true },
      );
    });

    it('no debería lanzar error si el token no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeFamily('inexistente')).resolves.toBeUndefined();
    });
  });

  describe('revokeAllForSub', () => {
    it('debería revocar todos los tokens activos del sub', async () => {
      mockRepo.update.mockResolvedValue({});
      await service.revokeAllForSub('admin-uuid');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { sub: 'admin-uuid', revoked: false },
        { revoked: true },
      );
    });

    it('debería usar el manager externo si se pasa', async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue({}),
        }),
      };
      await service.revokeAllForSub('admin-uuid', mockManager as unknown as EntityManager);
      expect(mockManager.getRepository).toHaveBeenCalledWith(RefreshTokenEntity);
    });
  });
});