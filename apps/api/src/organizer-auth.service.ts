import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OrganizerAuthService {
  constructor(@Inject(JwtService) private jwt: JwtService) {}

  bearerToken(header?: string): string | undefined {
    if (!header?.startsWith('Bearer ')) return undefined;
    const token = header.slice('Bearer '.length).trim();
    return token || undefined;
  }

  async requireOrganizer(authHeader?: string) {
    const token = this.bearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Autenticación de organizer requerida');
    }
    let payload: { role?: string; sub?: string; email?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (payload.role !== 'organizer') {
      throw new UnauthorizedException('Solo organizer puede realizar esta acción');
    }
    return payload;
  }
}
