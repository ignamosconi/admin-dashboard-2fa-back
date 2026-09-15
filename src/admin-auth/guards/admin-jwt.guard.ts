import { Request as ExpressRequest } from 'express';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminJwtPayloadDto } from '../dtos/admin-jwt-payload.dto.js';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExpressRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de admin no proporcionado.');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync<AdminJwtPayloadDto>(
        token,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_ADMIN_ACCESS_SECRET',
          ),
        },
      );
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Token de admin inválido o expirado.');
      }
      const typedRequest = request as ExpressRequest & {
        admin: AdminJwtPayloadDto;
      };
      typedRequest.admin = payload;
    } catch {
      throw new UnauthorizedException('Token de admin inválido o expirado.');
    }

    return true;
  }
}
