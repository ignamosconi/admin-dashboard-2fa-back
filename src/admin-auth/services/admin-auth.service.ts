import { Inject, Injectable, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { IAdminAuthService } from './admin-auth.service.interface.js';
import type { IPendingChallengeService } from './pending-challenge.service.interface.js';
import { AdminEntity } from '../../admin/entities/admin.entity.js';
import { AdminLoginRequestDto } from '../dtos/admin-login-request.dto.js';
import { AdminLoginResponseDto } from '../dtos/admin-login-response.dto.js';
import { Admin2faSetupRequestDto } from '../dtos/admin-2fa-setup-request.dto.js';
import { Admin2faSetupResponseDto } from '../dtos/admin-2fa-setup-response.dto.js';
import { Admin2faConfirmDto } from '../dtos/admin-2fa-confirm.dto.js';
import { Admin2faValidateDto } from '../dtos/admin-2fa-validate.dto.js';
import { AdminRefreshRequestDto } from '../dtos/admin-refresh-request.dto.js';
import { AdminLogoutRequestDto } from '../dtos/admin-logout-request.dto.js';
import { TokenResponseDto } from '../dtos/token-response.dto.js';
import type { IRefreshTokenService } from '../../refresh-token/services/refresh-token.service.interface.js';
import { Admin2faResetDto } from '../dtos/admin-2fa-reset.dto.js';

// Payload interno del JWT pending — incluye jti para referenciar el challenge en Redis
interface PendingJwtPayload {
  sub: string;
  jti: string;
  purpose: '2fa-setup' | '2fa-confirm';
  type: 'pending-2fa';
  iat?: number;
  exp?: number;
}

@Injectable()
export class AdminAuthService implements IAdminAuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly pendingSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly totpEncryptionKey: Buffer;
  private readonly pendingTtlMs: number;

  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('IRefreshTokenService')
    private readonly refreshTokenService: IRefreshTokenService,
    @Inject('IPendingChallengeService')
    private readonly pendingChallengeService: IPendingChallengeService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_ADMIN_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_ADMIN_REFRESH_SECRET');
    this.pendingSecret = this.accessSecret;
    this.accessExpiresIn = this.configService.getOrThrow<string>('JWT_ADMIN_ACCESS_EXPIRES_IN');
    this.refreshExpiresIn = this.configService.getOrThrow<string>('JWT_ADMIN_REFRESH_EXPIRES_IN');
    this.pendingTtlMs = parseInt(
      this.configService.getOrThrow<string>('PENDING_2FA_TTL_MS'),
      10,
    );

    const keyHex = this.configService.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
    if (keyHex.length !== 64) {
      throw new Error('TOTP_ENCRYPTION_KEY debe ser exactamente 64 caracteres hex (32 bytes).');
    }
    this.totpEncryptionKey = Buffer.from(keyHex, 'hex');
  }

  // ── Cifrado AES-256-GCM para el secret TOTP ──────────────────────────────

  private encryptTotp(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.totpEncryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptTotp(stored: string): string {
    const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.totpEncryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  // ── Pending token ─────────────────────────────────────────────────────────

  private async issuePendingToken(
    adminId: string,
    purpose: '2fa-setup' | '2fa-confirm',
  ): Promise<string> {
    const jti = randomUUID();
    const ttlSeconds = Math.floor(this.pendingTtlMs / 1000);

    // Primero crear el challenge en Redis — si falla, no emitimos el JWT
    await this.pendingChallengeService.create(jti, adminId, purpose);

    return this.jwtService.signAsync(
      { sub: adminId, jti, purpose, type: 'pending-2fa' },
      { secret: this.pendingSecret, expiresIn: ttlSeconds } as JwtSignOptions,
    );
  }

  private async verifyPendingToken(
    token: string,
    expectedPurpose: '2fa-setup' | '2fa-confirm',
  ): Promise<{ sub: string; jti: string }> {
    let payload: PendingJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<PendingJwtPayload>(token, {
        secret: this.pendingSecret,
      });
    } catch {
      throw new UnauthorizedException('Token de sesión pendiente inválido o expirado.');
    }

    if (payload.type !== 'pending-2fa') {
      throw new UnauthorizedException('Token inválido.');
    }

    // verify lanza UnauthorizedException si el challenge no existe en Redis
    // o si el purpose no coincide. También lanza ServiceUnavailableException
    // si Redis no está disponible — nunca hace fallback a aceptar el JWT solo.
    await this.pendingChallengeService.verify(payload.jti, expectedPurpose);

    return { sub: payload.sub, jti: payload.jti };
  }

  // ── Emisión de tokens reales ──────────────────────────────────────────────

  private async issueTokenPair(admin: AdminEntity): Promise<TokenResponseDto> {
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        { sub: admin.id, username: admin.username, type: 'access' },
        { secret: this.accessSecret, expiresIn: this.accessExpiresIn } as JwtSignOptions,
      ),
      this.jwtService.signAsync(
        { sub: admin.id, type: 'refresh', jti: randomUUID() },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn } as JwtSignOptions,
      ),
    ]);

    await this.refreshTokenService.save({
      token: refresh_token,
      sub: admin.id,
      type: 'admin',
      expiresIn: this.refreshExpiresIn,
    });

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: this.parseExpiresIn(this.accessExpiresIn),
    };
  }

  // ── Métodos públicos ──────────────────────────────────────────────────────

  async login(dto: AdminLoginRequestDto): Promise<AdminLoginResponseDto> {
    const admin = await this.adminRepository.findOne({ where: { username: dto.username } });
    if (!admin) throw new UnauthorizedException('Credenciales inválidas.');

    const valid = await bcrypt.compare(dto.password, admin.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas.');

    // El purpose del pending token depende de si el admin ya tiene 2FA configurado.
    // Un token con purpose 'setup' no puede usarse en /2fa/confirm y viceversa.
    const purpose = admin.totpEnabled ? '2fa-confirm' : '2fa-setup';
    const pending_token = await this.issuePendingToken(admin.id, purpose);

    return {
      pending_token,
      requires_2fa_setup: !admin.totpEnabled,
    };
  }

  async setup2fa(dto: Admin2faSetupRequestDto): Promise<Admin2faSetupResponseDto> {
    // verifyPendingToken valida firma JWT + challenge Redis + purpose '2fa-setup'
    const { sub, jti } = await this.verifyPendingToken(dto.pending_token, '2fa-setup');

    const admin = await this.adminRepository.findOne({ where: { id: sub } });
    if (!admin) throw new UnauthorizedException('Admin no encontrado.');

    // Problema 1: rechazar si el admin ya tiene 2FA activo.
    // Con el mecanismo de purpose esto ya está cubierto (el login emite un token
    // con purpose '2fa-confirm' si totpEnabled === true), pero lo verificamos
    // explícitamente como segunda línea de defensa.
    if (admin.totpEnabled) {
      throw new ForbiddenException(
        'El 2FA ya está configurado. Para regenerarlo usá /admin/auth/2fa/reset.',
      );
    }

    // Consumir el challenge atómicamente — después de esto, pending_token_1 no
    // puede reutilizarse ni siquiera si el JWT sigue siendo válido.
    await this.pendingChallengeService.consume(jti, '2fa-setup');

    // Generar nuevo secret TOTP
    const plainSecret = authenticator.generateSecret();
    admin.totpSecret = this.encryptTotp(plainSecret);
    // No activamos todavía — se activa en confirm2fa
    await this.adminRepository.save(admin);
    const otpAuthUrl = authenticator.keyuri(admin.username, this.configService.getOrThrow<string>('APP_NAME'), plainSecret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Emitir un nuevo pending token con purpose '2fa-confirm' para el siguiente paso.
    // El admin ahora debe confirmar el código TOTP para activar el 2FA.
    const confirm_pending_token = await this.issuePendingToken(admin.id, '2fa-confirm');

    return {
      qrCodeDataUrl,
      manualEntrySecret: plainSecret,
      confirm_pending_token,
    };
  }

  async confirm2fa(dto: Admin2faConfirmDto): Promise<TokenResponseDto> {
    // Verificar JWT + challenge Redis + purpose — sin consumir todavía.
    // El challenge solo se consume si el código TOTP es correcto.
    const { sub, jti } = await this.verifyPendingToken(dto.pending_token, '2fa-confirm');

    const admin = await this.adminRepository.findOne({ where: { id: sub } });
    if (!admin || !admin.totpSecret) {
      throw new UnauthorizedException('Primero debés configurar el 2FA con /2fa/setup.');
    }

    const plainSecret = this.decryptTotp(admin.totpSecret);
    const totpValid = authenticator.verify({ token: dto.totp_code, secret: plainSecret });

    // recordAttempt maneja el contador de intentos y el consumo atómico del challenge.
    const result = await this.pendingChallengeService.recordAttempt(jti, '2fa-confirm', totpValid);

    if (!result.ok) {
      if (result.reason === 'redis_unavailable') {
        throw new ServiceUnavailableException(
          'El servicio de autenticación no está disponible. Intentá de nuevo.',
        );
      }
      if (result.reason === 'max_attempts') {
        throw new UnauthorizedException(
          'Demasiados intentos fallidos. El proceso de verificación fue cancelado. Volvé a iniciar sesión.',
        );
      }
      throw new UnauthorizedException('Código 2FA inválido.');
    }

    // Activar 2FA definitivamente
    admin.totpEnabled = true;
    await this.adminRepository.save(admin);

    return this.issueTokenPair(admin);
  }

  async validate2fa(dto: Admin2faValidateDto): Promise<TokenResponseDto> {
    // Mismo mecanismo que confirm2fa pero para logins posteriores.
    const { sub, jti } = await this.verifyPendingToken(dto.pending_token, '2fa-confirm');

    const admin = await this.adminRepository.findOne({ where: { id: sub } });
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      throw new UnauthorizedException('2FA no configurado para este admin.');
    }

    const plainSecret = this.decryptTotp(admin.totpSecret);
    const totpValid = authenticator.verify({ token: dto.totp_code, secret: plainSecret });

    const result = await this.pendingChallengeService.recordAttempt(jti, '2fa-confirm', totpValid);

    if (!result.ok) {
      if (result.reason === 'redis_unavailable') {
        throw new ServiceUnavailableException(
          'El servicio de autenticación no está disponible. Intentá de nuevo.',
        );
      }
      if (result.reason === 'max_attempts') {
        throw new UnauthorizedException(
          'Demasiados intentos fallidos. El proceso de verificación fue cancelado. Volvé a iniciar sesión.',
        );
      }
      throw new UnauthorizedException('Código 2FA inválido.');
    }

    return this.issueTokenPair(admin);
  }

  async reset2fa(adminId: string, dto: Admin2faResetDto): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Admin no encontrado.');

    const valid = await bcrypt.compare(dto.password, admin.password);
    if (!valid) throw new UnauthorizedException('Password incorrecta.');

    admin.totpSecret = null;
    admin.totpEnabled = false;
    await this.adminRepository.save(admin);
  }

  async refresh(dto: AdminRefreshRequestDto): Promise<TokenResponseDto> {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; type: string }>(dto.refresh_token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('El token proporcionado no es un refresh token.');
    }

    const record = await this.refreshTokenService.consume(dto.refresh_token);

    const admin = await this.adminRepository.findOne({ where: { id: payload.sub } });
    if (!admin) throw new UnauthorizedException('Admin no encontrado.');

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: admin.id, username: admin.username, type: 'access' },
        { secret: this.accessSecret, expiresIn: this.accessExpiresIn } as JwtSignOptions,
      ),
      this.jwtService.signAsync(
        { sub: admin.id, type: 'refresh', jti: randomUUID() },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn } as JwtSignOptions,
      ),
    ]);

    await this.refreshTokenService.save({
      token: newRefreshToken,
      sub: admin.id,
      type: 'admin',
      expiresIn: this.refreshExpiresIn,
      familyId: record.familyId,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: this.parseExpiresIn(this.accessExpiresIn),
    };
  }

  async logout(dto: AdminLogoutRequestDto): Promise<void> {
    await this.refreshTokenService.revokeFamily(dto.refresh_token);
  }

  private parseExpiresIn(value: string): number {
    const unit = value.slice(-1);
    const amount = parseInt(value.slice(0, -1), 10);
    switch (unit) {
      case 's': return amount;
      case 'm': return amount * 60;
      case 'h': return amount * 60 * 60;
      case 'd': return amount * 60 * 60 * 24;
      default:  return parseInt(value, 10);
    }
  }
}