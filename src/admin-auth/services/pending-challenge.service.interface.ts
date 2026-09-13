export type ChallengeConsumeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'max_attempts' | 'redis_unavailable' };

export interface IPendingChallengeService {
  /**
   * Crea un challenge en Redis asociado al jti del JWT.
   * El TTL se toma de PENDING_2FA_TTL_MS.
   */
  create(jti: string, adminId: string, purpose: '2fa-setup' | '2fa-confirm'): Promise<void>;

  /**
   * Verifica que el challenge exista en Redis y que el purpose coincida.
   * No consume el challenge.
   * Lanza ServiceUnavailableException si Redis no responde.
   * Lanza UnauthorizedException si el challenge no existe o el purpose no coincide.
   */
  verify(jti: string, expectedPurpose: '2fa-setup' | '2fa-confirm'): Promise<{ adminId: string }>;

  /**
   * Consume el challenge atómicamente (GETDEL).
   * Úsalo cuando el challenge se agota en un solo uso exitoso (setup).
   * Lanza ServiceUnavailableException si Redis no responde.
   * Lanza UnauthorizedException si el challenge no existe.
   */
  consume(jti: string, expectedPurpose: '2fa-setup' | '2fa-confirm'): Promise<{ adminId: string }>;

  /**
   * Registra un intento fallido de TOTP y consume el challenge si el intento es correcto.
   * Usado exclusivamente en /2fa/confirm y /2fa/validate para evitar race conditions:
   * el challenge solo se elimina cuando el código TOTP es válido.
   *
   * Retorna:
   *  - { ok: true } → intento correcto, challenge consumido
   *  - { ok: false, reason: 'not_found' } → challenge inexistente o expirado
   *  - { ok: false, reason: 'max_attempts' } → límite de intentos alcanzado, challenge eliminado
   *  - { ok: false, reason: 'redis_unavailable' } → Redis no responde
   */
  recordAttempt(
    jti: string,
    expectedPurpose: '2fa-setup' | '2fa-confirm',
    totpValid: boolean,
  ): Promise<ChallengeConsumeResult>;
}