import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PosUserRole } from '@prisma/client';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from './prisma.service';

export type PosUserPublic = {
  id: string;
  storeId: string;
  username: string;
  name: string;
  role: PosUserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function assertPin(pin: unknown): string {
  const value = String(pin ?? '').trim();
  if (!/^\d{4}$/.test(value)) {
    throw new BadRequestException('El PIN debe tener exactamente 4 dígitos');
  }
  return value;
}

function assertUsername(username: unknown): string {
  const value = String(username ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(value)) {
    throw new BadRequestException(
      'El usuario debe tener 2-30 caracteres (letras, números, . _ -)'
    );
  }
  return value;
}

function assertRole(role: unknown): PosUserRole {
  if (
    role === 'ADMIN' ||
    role === 'ATENCION' ||
    role === 'CAJA' ||
    role === 'PREPARACION'
  ) {
    return role;
  }
  throw new BadRequestException('Rol inválido');
}

function toPublic(u: {
  id: string;
  storeId: string;
  username: string;
  name: string;
  role: PosUserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): PosUserPublic {
  return {
    id: u.id,
    storeId: u.storeId,
    username: u.username,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export type PosUserSessionPayload = {
  kind: 'pos-user';
  sub: string;
  storeId: string;
  role: PosUserRole;
  name: string;
};

@Injectable()
export class PosUsersService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwt: JwtService
  ) {}

  async list(storeId: string): Promise<PosUserPublic[]> {
    const users = await this.prisma.posUser.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toPublic);
  }

  async create(
    storeId: string,
    body: { username: string; name: string; pin: string; role: PosUserRole }
  ): Promise<PosUserPublic> {
    const username = assertUsername(body.username);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    if (name.length > 60) throw new BadRequestException('Nombre demasiado largo');
    const pin = assertPin(body.pin);
    const role = assertRole(body.role);
    const existing = await this.prisma.posUser.findFirst({
      where: { storeId, username },
    });
    if (existing) {
      throw new ConflictException('Ese nombre de usuario ya existe en este negocio');
    }
    const user = await this.prisma.posUser.create({
      data: { storeId, username, name, pinHash: hashPin(pin), role },
    });
    return toPublic(user);
  }

  async update(
    storeId: string,
    id: string,
    body: { name?: string; role?: PosUserRole; pin?: string; isActive?: boolean }
  ): Promise<PosUserPublic> {
    const current = await this.prisma.posUser.findFirst({
      where: { id, storeId },
    });
    if (!current) throw new NotFoundException('Usuario no encontrado');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException('El nombre es obligatorio');
      data.name = name;
    }
    if (body.role !== undefined) data.role = assertRole(body.role);
    if (body.pin !== undefined && String(body.pin).trim() !== '') {
      data.pinHash = hashPin(assertPin(body.pin));
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    const user = await this.prisma.posUser.update({ where: { id }, data });
    return toPublic(user);
  }

  /**
   * Login con ámbito de tienda: `storeRef` es el id o el slug del negocio
   * (viene de la URL /[store]/login de la PWA). El mismo username puede
   * existir en varias tiendas.
   */
  async login(storeRef: string, username: string, pin: string) {
    const storeRefTrim = String(storeRef ?? '').trim();
    const store = storeRefTrim
      ? await this.prisma.store.findFirst({
          where: { OR: [{ id: storeRefTrim }, { slug: storeRefTrim }] },
          select: {
            id: true,
            slug: true,
            name: true,
            currency: true,
            ondaValue: true,
            maxStamps: true,
            posEnabled: true,
            posSharedTabs: true,
          },
        })
      : null;
    if (storeRefTrim && !store) {
      throw new NotFoundException('Negocio no encontrado');
    }
    const normalized = String(username ?? '').trim().toLowerCase();
    const user = store?.id
      ? await this.prisma.posUser.findFirst({
          where: { storeId: store.id, username: normalized },
        })
      : null;
    if (!user || !user.isActive || !verifyPin(String(pin ?? ''), user.pinHash)) {
      throw new UnauthorizedException('Usuario o PIN incorrectos');
    }
    await this.prisma.posUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const payload: PosUserSessionPayload = {
      kind: 'pos-user',
      sub: user.id,
      storeId: user.storeId,
      role: user.role,
      name: user.name,
    };
    return {
      token: await this.jwt.signAsync(payload),
      user: toPublic({ ...user, lastLoginAt: new Date() }),
      store,
    };
  }

  /** Estadísticas por usuario en un rango de fechas (ventas + acumulación). */
  async stats(storeId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const dateRange =
      fromDate || toDate
        ? {
            completedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {};
    const txDateRange =
      fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {};

    const [users, sales, transactions] = await Promise.all([
      this.prisma.posUser.findMany({
        where: { storeId },
        select: { id: true, username: true, name: true, role: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.posSale.groupBy({
        by: ['posUserId'],
        where: { storeId, status: 'COMPLETED', ...dateRange },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['posUserId', 'type'],
        where: { storeId, posUserId: { not: null }, ...txDateRange },
        _count: { _all: true },
        _sum: { points: true, paymentAmount: true },
      }),
    ]);

    const salesByUser = new Map(sales.map((s) => [s.posUserId, s]));
    const txByUser = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const list = txByUser.get(t.posUserId as string) ?? [];
      list.push(t);
      txByUser.set(t.posUserId as string, list);
    }

    return users.map((u) => {
      const s = salesByUser.get(u.id);
      const txs = txByUser.get(u.id) ?? [];
      const acc = txs.find((t) => t.type === 'ACCUMULATE');
      const red = txs.find((t) => t.type === 'REDEEM');
      return {
        ...u,
        sales: {
          count: s?._count._all ?? 0,
          totalCop: s?._sum.total ?? 0,
        },
        accumulate: {
          count: acc?._count._all ?? 0,
          ondas: acc?._sum.points ?? 0,
          salesCop: acc?._sum.paymentAmount ?? 0,
        },
        redeem: {
          count: red?._count._all ?? 0,
          ondas: red?._sum.points ?? 0,
        },
      };
    });
  }
}
