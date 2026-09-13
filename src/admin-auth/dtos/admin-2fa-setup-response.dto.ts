import { ApiProperty } from '@nestjs/swagger';

export class Admin2faSetupResponseDto {
  @ApiProperty({ description: 'URL de datos del QR para escanear con el autenticador' })
  readonly qrCodeDataUrl!: string;

  @ApiProperty({ description: 'Secret en texto plano, para ingreso manual en el autenticador' })
  readonly manualEntrySecret!: string;

  @ApiProperty({
    description:
      'Nuevo pending token con purpose 2fa-confirm. ' +
      'Usarlo en /2fa/confirm para activar el 2FA. ' +
      'El pending token original (usado en /2fa/setup) ya fue consumido y no puede reutilizarse.',
  })
  readonly confirm_pending_token!: string;
}