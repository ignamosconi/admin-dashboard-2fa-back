

import { Injectable, Inject, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module.js';
import { IPendingChallengeService, ChallengeConsumeResult } from './pending-challenge.service.interface.js';

interface ChallengePayload {
  adminId: string;
  purpose: '2fa-setup' | '2fa-confirm';
  attempts: number;
}

@Injectable()
export class PendingChallengeService implements IPendingChallengeService {
  private readonly ttlMs: number;
  private readonly maxAttempts: number;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.ttlMs = parseInt(
      this.configService.getOrThrow<string>('PENDING_2FA_TTL_MS'),
      10,
    );
    this.maxAttempts = parseInt(
      this.configService.get<string>('PENDING_2FA_MAX_ATTEMPTS') ?? '5',
      10,
    );
  }

  private key(jti: string): string {
    return `pending-2fa:${jti}`;
  }

  async create(
    jti: string,
    adminId: string,
    purpose: '2fa-setup' | '2fa-confirm',
  ): Promise<void> {
    const payload: ChallengePayload = { adminId, purpose, attempts: 0 };
    try {
      await this.redis.set(
        this.key(jti),
        JSON.stringify(payload),
        'PX',
        this.ttlMs,
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo crear el challenge de autenticación. Intentá de nuevo.',
      );
    }
  }

  async verify(
    jti: string,
    expectedPurpose: '2fa-setup' | '2fa-confirm',
  ): Promise<{ adminId: string }> {
    let raw: string | null;
    try {
      raw = await this.redis.get(this.key(jti));
    } catch {
      throw new ServiceUnavailableException(
        'El servicio de autenticación no está disponible. Intentá de nuevo.',
      );
    }

    if (!raw) {
      throw new UnauthorizedException('Token de sesión pendiente inválido o expirado.');
    }

    const payload = JSON.parse(raw) as ChallengePayload;

    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('Token de sesión pendiente inválido para esta operación.');
    }

    return { adminId: payload.adminId };
  }

  async consume(
    jti: string,
    expectedPurpose: '2fa-setup' | '2fa-confirm',
  ): Promise<{ adminId: string }> {
    let raw: string | null;
    try {
      // GETDEL es atómico: obtiene y elimina en una sola operación.
      // Dos requests concurrentes con el mismo jti: solo una obtiene el valor,
      // la otra recibe null.
      raw = await this.redis.getdel(this.key(jti));
    } catch {
      throw new ServiceUnavailableException(
        'El servicio de autenticación no está disponible. Intentá de nuevo.',
      );
    }

    if (!raw) {
      throw new UnauthorizedException('Token de sesión pendiente inválido o expirado.');
    }

    const payload = JSON.parse(raw) as ChallengePayload;

    if (payload.purpose !== expectedPurpose) {
      // El challenge ya fue eliminado en este punto — si el purpose no coincide,
      // rechazamos igual. El challenge no se puede recuperar (correcto por diseño).
      throw new UnauthorizedException('Token de sesión pendiente inválido para esta operación.');
    }

    return { adminId: payload.adminId };
  }

  async recordAttempt(
    jti: string,
    expectedPurpose: '2fa-setup' | '2fa-confirm',
    totpValid: boolean,
  ): Promise<ChallengeConsumeResult> {
    // Lua script para operación atómica:
    // 1. Si el challenge no existe → retorna 'not_found'
    // 2. Si purpose no coincide → retorna 'not_found' (tratamos igual que inexistente)
    // 3. Si el código es correcto → elimina el challenge y retorna 'ok'
    // 4. Si el código es incorrecto:
    //    a. Incrementa attempts
    //    b. Si superó el máximo → elimina el challenge y retorna 'max_attempts'
    //    c. Si no → actualiza el challenge con el nuevo contador y retorna 'retry'
    //
    // KEYS[1] = clave Redis
    // ARGV[1] = purpose esperado
    // ARGV[2] = '1' si el código es correcto, '0' si no
    // ARGV[3] = maxAttempts

    /*
    Nótese que el caso 'retry' del Lua script (intento fallido, challenge sigue activo) se mapea intencionalmente 
    a not_found en el resultado público del método. El llamador en admin-auth.service.ts solo necesita saber si 
    el intento fue exitoso o no; el manejo interno de reintentos lo hace el Lua script.
    */
    const luaScript = `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return 'not_found' end

      local payload = cjson.decode(raw)
      if payload.purpose ~= ARGV[1] then return 'not_found' end

      if ARGV[2] == '1' then
        redis.call('DEL', KEYS[1])
        return 'ok'
      end

      payload.attempts = payload.attempts + 1
      if payload.attempts >= tonumber(ARGV[3]) then
        redis.call('DEL', KEYS[1])
        return 'max_attempts'
      end

      local ttl = redis.call('PTTL', KEYS[1])
      if ttl > 0 then
        redis.call('SET', KEYS[1], cjson.encode(payload), 'PX', ttl)
      else
        redis.call('SET', KEYS[1], cjson.encode(payload))
      end
      return 'retry'
    `;

    let result: unknown;
    try {
      result = await this.redis.eval(
        luaScript,
        1,
        this.key(jti),
        expectedPurpose,
        totpValid ? '1' : '0',
        String(this.maxAttempts),
      );
    } catch {
      return { ok: false, reason: 'redis_unavailable' };
    }

    if (result === 'ok') return { ok: true };
    if (result === 'max_attempts') return { ok: false, reason: 'max_attempts' };
    if (result === 'not_found') return { ok: false, reason: 'not_found' };

    // 'retry' → intento fallido pero challenge sigue activo
    return { ok: false, reason: 'not_found' };
  }
}