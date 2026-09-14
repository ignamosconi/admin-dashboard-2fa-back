import { EntityManager } from 'typeorm';
import { AdminEntity } from '../../entities/admin.entity.js';

export interface IAdminRepository {
  findAll(): Promise<AdminEntity[]>;
  findById(id: string): Promise<AdminEntity | null>;
  findByUsername(username: string): Promise<AdminEntity | null>;
  save(admin: Partial<AdminEntity>): Promise<AdminEntity>;
  count(): Promise<number>;
  remove(admin: AdminEntity, manager?: EntityManager): Promise<void>;
  transaction<T>(runInTransaction: (manager: EntityManager) => Promise<T>): Promise<T>;
}