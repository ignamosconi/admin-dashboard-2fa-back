import {
  Controller,
  Post,
  Body,
  Inject,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../guards/admin-jwt.guard.js';
import { Admin2faResetDto } from '../dtos/admin-2fa-reset.dto.js';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  IAdminAuthController,
  RequestWithAdmin,
} from './interfaces/admin-auth.controller.interface.js';
import type { IAdminAuthService } from '../services/interfaces/admin-auth.service.interface.js';
import { AdminLoginRequestDto } from '../dtos/admin-login-request.dto.js';
import { AdminLoginResponseDto } from '../dtos/admin-login-response.dto.js';
import { Admin2faSetupRequestDto } from '../dtos/admin-2fa-setup-request.dto.js';
import { Admin2faSetupResponseDto } from '../dtos/admin-2fa-setup-response.dto.js';
import { Admin2faConfirmDto } from '../dtos/admin-2fa-confirm.dto.js';
import { Admin2faValidateDto } from '../dtos/admin-2fa-validate.dto.js';
import { AdminRefreshRequestDto } from '../dtos/admin-refresh-request.dto.js';
import { AdminLogoutRequestDto } from '../dtos/admin-logout-request.dto.js';
import { TokenResponseDto } from '../dtos/token-response.dto.js';

@ApiTags('Admin — Autenticación')
@Controller('admin/auth')
export class AdminAuthController implements IAdminAuthController {
  constructor(
    @Inject('IAdminAuthService')
    private readonly adminAuthService: IAdminAuthService,
  ) {}

  @ApiOperation({
    summary: 'Login de administrador (paso 1)',
    description:
      'Valida credenciales y devuelve un pending_token. Si requires_2fa_setup es true, ir a /2fa/setup. Si es false, ir a /2fa/validate.',
  })
  @ApiResponse({ status: 201, type: AdminLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() dto: AdminLoginRequestDto): Promise<AdminLoginResponseDto> {
    return this.adminAuthService.login(dto);
  }

  @ApiOperation({
    summary: 'Configurar 2FA (paso 2a — solo primera vez)',
    description:
      'Genera un secret TOTP y devuelve el QR para escanear con el autenticador. Requiere pending_token del login.',
  })
  @ApiResponse({ status: 201, type: Admin2faSetupResponseDto })
  @ApiResponse({
    status: 401,
    description: 'pending_token inválido o expirado',
  })
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('2fa/setup')
  setup2fa(
    @Body() dto: Admin2faSetupRequestDto,
  ): Promise<Admin2faSetupResponseDto> {
    return this.adminAuthService.setup2fa(dto);
  }

  @ApiOperation({
    summary:
      'Confirmar configuración 2FA y obtener tokens (paso 3a — solo primera vez)',
    description:
      'Valida el primer código TOTP, activa el 2FA en la cuenta y emite access_token + refresh_token reales.',
  })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Código 2FA inválido o pending_token expirado',
  })
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('2fa/confirm')
  confirm2fa(@Body() dto: Admin2faConfirmDto): Promise<TokenResponseDto> {
    return this.adminAuthService.confirm2fa(dto);
  }

  @ApiOperation({
    summary:
      'Validar código 2FA y obtener tokens (paso 2b — logins posteriores)',
    description:
      'Para admins que ya tienen 2FA activo. Valida el código TOTP y emite access_token + refresh_token reales.',
  })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Código 2FA inválido o pending_token expirado',
  })
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('2fa/validate')
  validate2fa(@Body() dto: Admin2faValidateDto): Promise<TokenResponseDto> {
    return this.adminAuthService.validate2fa(dto);
  }

  @ApiOperation({
    summary: 'Resetear 2FA',
    description:
      'Invalida el secret TOTP actual del admin. El próximo login requerirá configurar 2FA de nuevo. Requiere confirmar la password actual.',
  })
  @ApiResponse({ status: 204, description: '2FA reseteado correctamente' })
  @ApiResponse({
    status: 401,
    description: 'Password incorrecta o token inválido',
  })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(AdminJwtGuard)
  @HttpCode(204)
  @Post('2fa/reset')
  reset2fa(
    @Request() req: RequestWithAdmin,
    @Body() dto: Admin2faResetDto,
  ): Promise<void> {
    return this.adminAuthService.reset2fa(req.admin.sub, dto);
  }

  @ApiOperation({ summary: 'Renovar access token de administrador' })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido o expirado',
  })
  @Post('refresh')
  refresh(@Body() dto: AdminRefreshRequestDto): Promise<TokenResponseDto> {
    return this.adminAuthService.refresh(dto);
  }

  @ApiOperation({ summary: 'Cerrar sesión de administrador' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada correctamente' })
  @HttpCode(204)
  @Post('logout')
  logout(@Body() dto: AdminLogoutRequestDto): Promise<void> {
    return this.adminAuthService.logout(dto);
  }
}
