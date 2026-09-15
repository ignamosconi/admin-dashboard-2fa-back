import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AdminEntity } from '../entities/admin.entity.js';
import { IAdminRepository } from './interfaces/admin.repository.interface.js';

@Injectable()
export class AdminRepository implements IAdminRepository {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly repo: Repository<AdminEntity>,
  ) {}

  async findAll(): Promise<AdminEntity[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<AdminEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<AdminEntity | null> {
    return this.repo.findOne({ where: { username } });
  }

  async save(admin: Partial<AdminEntity>): Promise<AdminEntity> {
    // Si se pasa una entidad parcial (ej. desde el seeder), la crea. Si ya es entidad, la actualiza.
    const entity = this.repo.create(admin);
    return this.repo.save(entity);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async remove(admin: AdminEntity, manager?: EntityManager): Promise<void> {
    if (manager) {
      await manager.remove(admin);
    } else {
      await this.repo.remove(admin);
    }
  }

  async transaction<T>(
    runInTransaction: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.repo.manager.transaction(runInTransaction);
  }
}
