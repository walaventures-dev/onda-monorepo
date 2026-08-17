import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable()
export class StoreAccessService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(FirebaseAuthService) private firebase: FirebaseAuthService
  ) {}

  bearerToken(header?: string): string | undefined {
    if (!header?.startsWith('Bearer ')) return undefined;
    const token = header.slice('Bearer '.length).trim();
    return token || undefined;
  }

  async requireStore(
    storeId: string,
    authHeader?: string,
    queryToken?: string
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    await this.assertCanAccess(store.id, authHeader, queryToken);
    return store;
  }

  async resolveCajaToken(token: string) {
    const link = await this.prisma.cajaLink.findUnique({
      where: { token },
      include: { store: { select: { id: true, name: true, currency: true } } },
    });
    if (!link || link.revokedAt) {
      throw new UnauthorizedException('Enlace de caja inválido o revocado');
    }
    await this.prisma.cajaLink.update({
      where: { id: link.id },
      data: { lastUsedAt: new Date() },
    });
    return link;
  }

  private async assertCanAccess(
    storeId: string,
    authHeader?: string,
    queryToken?: string
  ) {
    const raw = (queryToken || this.bearerToken(authHeader) || '').trim();
    if (raw) {
      const link = await this.prisma.cajaLink.findUnique({
        where: { token: raw },
      });
      if (link && !link.revokedAt) {
        if (link.storeId !== storeId) {
          throw new ForbiddenException('Este enlace no es de esta sede');
        }
        await this.prisma.cajaLink.update({
          where: { id: link.id },
          data: { lastUsedAt: new Date() },
        });
        return;
      }
    }

    if (!this.firebase.isConfigured) return;

    const header =
      authHeader ||
      (raw ? `Bearer ${raw}` : undefined);
    if (!header) {
      throw new UnauthorizedException('Falta token de sesión');
    }
    const email = await this.firebase.emailFromAuthHeader(header);
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { ownerEmail: true },
    });
    if (store.ownerEmail?.trim().toLowerCase() !== email) {
      throw new ForbiddenException('No puedes operar esta sede');
    }
  }
}
