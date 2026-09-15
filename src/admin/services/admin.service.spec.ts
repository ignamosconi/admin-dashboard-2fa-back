import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service.js';
import { AdminEntity } from '../entities/admin.entity.js';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

type MockAdminRepository = {
  findAll: jest.Mock;
  findById: jest.Mock;
  findByUsername: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
  remove: jest.Mock;
  transaction: jest.Mock;
};

type MockRefreshTokenService = {
  revokeAllForSub: jest.Mock;
};

function makeAdmin(overrides: Partial<AdminEntity> = {}): AdminEntity {
  return {
    id: 'uuid-1',
    username: 'admin',
    password: '$2b$12$hashedpassword',
    totpSecret: null,
    totpEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let mockRepo: MockAdminRepository;
  let mockRefreshTokenService: MockRefreshTokenService;

  beforeEach(async () => {
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
      transaction: jest.fn(),
    };

    mockRefreshTokenService = {
      revokeAllForSub: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: 'IAdminRepository', useValue: mockRepo },
        { provide: 'IRefreshTokenService', useValue: mockRefreshTokenService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('findAll', () => {
    it('debería retornar todos los admins mapeados a DTO', async () => {
      mockRepo.findAll.mockResolvedValue([makeAdmin(), makeAdmin({ id: 'uuid-2', username: 'otro' })]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    it('debería retornar el admin si existe', async () => {
      mockRepo.findById.mockResolvedValue(makeAdmin());
      const result = await service.findOne('uuid-1');
      expect(result.id).toBe('uuid-1');
      expect(result.username).toBe('admin');
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debería crear un admin nuevo', async () => {
      mockRepo.findByUsername.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword');
      mockRepo.save.mockResolvedValue(makeAdmin());

      const result = await service.create({ username: 'admin', password: 'password123' });
      expect(result.username).toBe('admin');
      expect(result).not.toHaveProperty('password');
    });

    it('debería lanzar ConflictException si el username ya existe', async () => {
      mockRepo.findByUsername.mockResolvedValue(makeAdmin());
      await expect(service.create({ username: 'admin', password: 'password123' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('updateSelf', () => {
    it('debería lanzar NotFoundException si el admin no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateSelf('inexistente', { currentPassword: 'password123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si la contraseña actual es incorrecta', async () => {
      mockRepo.findById.mockResolvedValue(makeAdmin());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateSelf('uuid-1', { currentPassword: 'wrong_password' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar ConflictException si intenta cambiar a un username que ya existe', async () => {
      mockRepo.findById.mockResolvedValue(makeAdmin({ username: 'admin' }));
      mockRepo.findByUsername.mockResolvedValue(makeAdmin({ id: 'uuid-2', username: 'nuevo_username' }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateSelf('uuid-1', {
          username: 'nuevo_username',
          currentPassword: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debería actualizar el usuario correctamente si la contraseña actual es correcta', async () => {
      const adminEntity = makeAdmin({ username: 'admin' });
      mockRepo.findById.mockResolvedValue(adminEntity);
      mockRepo.findByUsername.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRepo.save.mockImplementation((entity: AdminEntity) => Promise.resolve(entity));

      const result = await service.updateSelf('uuid-1', {
        username: 'admin_nuevo',
        currentPassword: 'password123',
      });

      expect(result.username).toBe('admin_nuevo');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('debería actualizar la contraseña si se envía una nueva y la actual es correcta', async () => {
      const adminEntity = makeAdmin();
      mockRepo.findById.mockResolvedValue(adminEntity);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockRepo.save.mockImplementation((entity: AdminEntity) => Promise.resolve(entity));

      await service.updateSelf('uuid-1', {
        password: 'new_password123',
        currentPassword: 'password123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('new_password123', 12);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debería lanzar NotFoundException si el admin no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.remove('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si es el último admin', async () => {
      mockRepo.findById.mockResolvedValue(makeAdmin());
      mockRepo.count.mockResolvedValue(1);
      await expect(service.remove('uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('debería revocar tokens y eliminar el admin en una transacción', async () => {
      mockRepo.findById.mockResolvedValue(makeAdmin());
      mockRepo.count.mockResolvedValue(2);

      mockRepo.transaction.mockImplementation(
        async (cb: (manager: EntityManager) => Promise<void>): Promise<void> => {
          await cb({} as EntityManager);
        },
      );
      mockRefreshTokenService.revokeAllForSub.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      expect(mockRepo.transaction).toHaveBeenCalled();
      expect(mockRefreshTokenService.revokeAllForSub).toHaveBeenCalledWith('uuid-1', expect.anything());
    });
  });
});