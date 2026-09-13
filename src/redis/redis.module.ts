import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const host = configService.getOrThrow<string>('REDIS_HOST');
        const port = configService.getOrThrow<number>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');
        const client = new Redis({ host, port, password });

        client.on('error', (err: Error) => {
          // Logueamos pero no silenciamos — si Redis no está disponible,
          // los endpoints que dependen de él deben fallar explícitamente.
          console.error('[Redis] Error de conexión:', err.message);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}