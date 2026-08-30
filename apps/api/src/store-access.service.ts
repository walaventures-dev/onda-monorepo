import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { StoreMemberRole, StoreMemberStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';

export type StoreAccessContext = {
  storeId: string;
  email: string | null;
  role: StoreMemberRole | null;
  memberId: string | null;
  viaCajaToken: boolean;
};

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

  async resolveAccess(
    storeId: string,
    authHeader?: string,
    queryToken?: string
  ): Promise<StoreAccessContext> {
    const raw = (queryToken || this.bearerToken(authHeader) || '').trim();
    if (raw) {
      const link = await this.prisma.cajaLink.findUnique({
        where: { token: raw },
      });
      if (link && !link.revokedAt && link.storeId === storeId) {
        await this.prisma.cajaLink.update({
          where: { id: link.id },
          data: { lastUsedAt: new Date() },
        });
        return {
          storeId,
          email: null,
          role: null,
          memberId: null,
          viaCajaToken: true,
        };
      }
    }

    if (!this.firebase.isConfigured) {
      return {
        storeId,
        email: null,
        role: StoreMemberRole.ADMIN,
        memberId: null,
        viaCajaToken: false,
      };
    }

    const header =
      authHeader || (raw ? `Bearer ${raw}` : undefined);
    if (!header) {
      throw new UnauthorizedException('Falta token de sesión');
    }
    const email = await this.firebase.emailFromAuthHeader(header);
    const member = await this.resolveMember(storeId, email);
    if (!member) {
      throw new ForbiddenException('No puedes operar esta sede');
    }
    return {
      storeId,
      email,
      role: member.role,
      memberId: member.id,
      viaCajaToken: false,
    };
  }

  async requireRole(
    storeId: string,
    authHeader: string | undefined,
    queryToken: string | undefined,
    ...roles: StoreMemberRole[]
  ): Promise<StoreAccessContext> {
    const ctx = await this.resolveAccess(storeId, authHeader, queryToken);
    if (ctx.viaCajaToken) {
      return ctx;
    }
    if (!ctx.role || !roles.includes(ctx.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return ctx;
  }

  async requirePosEnabled(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { posEnabled: true },
    });
    if (!store?.posEnabled) {
      throw new ForbiddenException(
        'El POS no está habilitado en este negocio. Actívalo en Configuración.'
      );
    }
  }

  async resolveCajaToken(token: string) {
    const link = await this.prisma.cajaLink.findUnique({
      where: { token },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            currency: true,
            ondaValue: true,
            maxStamps: true,
            posEnabled: true,
          },
        },
      },
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

  async resolveMember(storeId: string, email: string) {
    const normalized = email.trim().toLowerCase();
    let member = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        email: { equals: normalized, mode: 'insensitive' },
        status: StoreMemberStatus.ACTIVE,
      },
    });
    if (member) return member;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { ownerEmail: true, ownerName: true },
    });
    if (
      store?.ownerEmail &&
      store.ownerEmail.trim().toLowerCase() === normalized
    ) {
      member = await this.prisma.storeMember.upsert({
        where: {
          storeId_email: { storeId, email: store.ownerEmail.trim() },
        },
        create: {
          storeId,
          email: store.ownerEmail.trim(),
          name: store.ownerName || 'Admin',
          role: StoreMemberRole.ADMIN,
          status: StoreMemberStatus.ACTIVE,
          acceptedAt: new Date(),
        },
        update: {
          status: StoreMemberStatus.ACTIVE,
          role: StoreMemberRole.ADMIN,
        },
      });
    }
    return member;
  }

  async storesForEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const members = await this.prisma.storeMember.findMany({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        status: StoreMemberStatus.ACTIVE,
      },
      include: {
        store: {
          include: {
            passDesign: {
              select: {
                logoUrl: true,
                backgroundColor: true,
                foregroundColor: true,
                labelColor: true,
              },
            },
            _count: { select: { promotions: true } },
            cartillas: {
              where: { isDefault: true },
              select: {
                id: true,
                isDefault: true,
                _count: { select: { items: true } },
              },
            },
          },
        },
      },
      orderBy: { acceptedAt: 'desc' },
    });

    if (members.length) {
      return members.map((m) => ({
        ...m.store,
        memberRole: m.role,
        memberName: m.name,
      }));
    }

    return this.prisma.store.findMany({
      where: { ownerEmail: { equals: normalized, mode: 'insensitive' } },
      include: {
        passDesign: {
          select: {
            logoUrl: true,
            backgroundColor: true,
            foregroundColor: true,
            labelColor: true,
          },
        },
        _count: { select: { promotions: true } },
        cartillas: {
          where: { isDefault: true },
          select: {
            id: true,
            isDefault: true,
            _count: { select: { items: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }).then((stores) =>
      stores.map((s) => ({
        ...s,
        memberRole: 'ADMIN' as StoreMemberRole,
        memberName: s.ownerName,
      }))
    );
  }

  private async assertCanAccess(
    storeId: string,
    authHeader?: string,
    queryToken?: string
  ) {
    await this.resolveAccess(storeId, authHeader, queryToken);
  }
}
