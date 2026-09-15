import { AdminLoginRequestDto } from '../../dtos/admin-login-request.dto.js';
import { AdminRefreshRequestDto } from '../../dtos/admin-refresh-request.dto.js';
import { AdminLogoutRequestDto } from '../../dtos/admin-logout-request.dto.js';
import { AdminLoginResponseDto } from '../../dtos/admin-login-response.dto.js';
import { Admin2faSetupRequestDto } from '../../dtos/admin-2fa-setup-request.dto.js';
import { Admin2faSetupResponseDto } from '../../dtos/admin-2fa-setup-response.dto.js';
import { Admin2faConfirmDto } from '../../dtos/admin-2fa-confirm.dto.js';
import { Admin2faValidateDto } from '../../dtos/admin-2fa-validate.dto.js';
import { Admin2faResetDto } from '../../dtos/admin-2fa-reset.dto.js';
import { TokenResponseDto } from '../../dtos/token-response.dto.js';
import { AdminJwtPayloadDto } from '../../dtos/admin-jwt-payload.dto.js';

export interface RequestWithAdmin {
  admin: AdminJwtPayloadDto;
}

export interface IAdminAuthController {
  login(dto: AdminLoginRequestDto): Promise<AdminLoginResponseDto>;
  setup2fa(dto: Admin2faSetupRequestDto): Promise<Admin2faSetupResponseDto>;
  confirm2fa(dto: Admin2faConfirmDto): Promise<TokenResponseDto>;
  validate2fa(dto: Admin2faValidateDto): Promise<TokenResponseDto>;
  reset2fa(req: RequestWithAdmin, dto: Admin2faResetDto): Promise<void>;
  refresh(dto: AdminRefreshRequestDto): Promise<TokenResponseDto>;
  logout(dto: AdminLogoutRequestDto): Promise<void>;
}
