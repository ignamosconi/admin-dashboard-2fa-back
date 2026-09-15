import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service.js';
import { AdminEntity } from '../entities/admin.entity.js';

type MockEntityManager = {
  remove: jest.Mock;
  getRepository: jest.Mock;
};

type MockRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
  remove: jest.Mock;
  manager: {
    transaction: jest.Mock;
  };
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
  let mockRepo: MockRepository;
  let mockRefreshTokenService: MockRefreshTokenService;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    mockRefreshTokenService = {
      revokeAllForSub: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(AdminEntity), useValue: mockRepo },
        { provide: 'IRefreshTokenService', useValue: mockRefreshTokenService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('findAll', () => {
    it('debería retornar todos los admins mapeados a DTO', async () => {
      mockRepo.find.mockResolvedValue([makeAdmin(), makeAdmin({ id: 'uuid-2', username: 'otro' })]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    it('debería retornar el admin si existe', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      const result = await service.findOne('uuid-1');
      expect(result.id).toBe('uuid-1');
      expect(result.username).toBe('admin');
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debería crear un admin nuevo', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(makeAdmin());
      mockRepo.save.mockResolvedValue(makeAdmin());

      const result = await service.create({ username: 'admin', password: 'password123' });
      expect(result.username).toBe('admin');
      expect(result).not.toHaveProperty('password');
    });

    it('debería lanzar ConflictException si el username ya existe', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      await expect(service.create({ username: 'admin', password: 'password123' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('updateSelf', () => {
    it('debería lanzar NotFoundException si el admin no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateSelf('inexistente', { currentPassword: 'password123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si la contraseña actual es incorrecta', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.updateSelf('uuid-1', { currentPassword: 'wrong_password' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar ConflictException si intenta cambiar a un username que ya existe', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeAdmin({ username: 'admin' })) // Primer llamado (buscar mi admin)
        .mockResolvedValueOnce(makeAdmin({ id: 'uuid-2', username: 'nuevo_username' })); // Segundo llamado (validar duplicado)

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(
        service.updateSelf('uuid-1', {
          username: 'nuevo_username',
          currentPassword: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debería actualizar el usuario correctamente si la contraseña actual es correcta', async () => {
      const adminEntity = makeAdmin({ username: 'admin' });
      mockRepo.findOne
        .mockResolvedValueOnce(adminEntity) // Buscar mi admin
        .mockResolvedValueOnce(null); // Validar que el username nuevo está libre

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockRepo.save.mockImplementation(async (entity) => entity);

      const result = await service.updateSelf('uuid-1', {
        username: 'admin_nuevo',
        currentPassword: 'password123',
      });

      expect(result.username).toBe('admin_nuevo');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('debería actualizar la contraseña si se envía una nueva y la actual es correcta', async () => {
      const adminEntity = makeAdmin();
      mockRepo.findOne.mockResolvedValue(adminEntity);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new_hashed_password' as never);
      mockRepo.save.mockImplementation(async (entity) => entity);

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
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si es el último admin', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      mockRepo.count.mockResolvedValue(1);
      await expect(service.remove('uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('debería revocar tokens y eliminar el admin en una transacción', async () => {
      mockRepo.findOne.mockResolvedValue(makeAdmin());
      mockRepo.count.mockResolvedValue(2);

      mockRepo.manager.transaction.mockImplementation(
        async (
          cb: (manager: MockEntityManager) => Promise<void>,
        ): Promise<void> => {
          await cb({
            remove: jest.fn(),
            getRepository: jest.fn(),
          });
        },
      );
      mockRefreshTokenService.revokeAllForSub.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      expect(mockRepo.manager.transaction).toHaveBeenCalled();
      expect(mockRefreshTokenService.revokeAllForSub).toHaveBeenCalledWith('uuid-1', expect.anything());
    });
  });
});