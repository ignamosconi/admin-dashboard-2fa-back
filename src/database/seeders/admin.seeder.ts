import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { IAdminRepository } from '../../admin/repositories/interfaces/admin.repository.interface.js';

@Injectable()
export class AdminSeeder {
  constructor(
    @Inject('IAdminRepository')
    private readonly adminRepository: IAdminRepository,
    private readonly configService: ConfigService,
  ) {}

  async seed(): Promise<void> {
    const env = this.configService.get<string>('NODE_ENV') ?? 'development';

    if (env === 'production') {
      console.log('[Seeder] Entorno production detectado — seeder deshabilitado.');
      return;
    }

    const username = this.configService.getOrThrow<string>('ADMIN_USERNAME_SEEDER');
    const password = this.configService.getOrThrow<string>('ADMIN_PASSWORD_SEEDER');

    const exists = await this.adminRepository.findByUsername(username);
    if (exists) return;

    const hashed = await bcrypt.hash(password, 12);
    await this.adminRepository.save({ username, password: hashed });

    console.log(`[Seeder] Admin "${username}" creado.`);
  }
}