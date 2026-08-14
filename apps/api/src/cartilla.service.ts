import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  CartillaStatus,
  Prisma,
  PromotionPool,
  type PassDesign,
  type Promotion,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import { WalletService } from './wallet.service';
import { BrevoService } from './brevo.service';

export const PROMO_ASSIGNMENT_TOLERANCE = 0.15;
export const CARTILLA_CYCLES = [4, 6, 8, 10, 12] as const;
export type CartillaCycle = (typeof CARTILLA_CYCLES)[number];

export function snapCartillaCycle(n: number): CartillaCycle {
  if ((CARTILLA_CYCLES as readonly number[]).includes(n)) return n as CartillaCycle;
  return CARTILLA_CYCLES.reduce((best, x) =>
    Math.abs(x - n) < Math.abs(best - n) ? x : best
  );
}

function assertCycle(n: number): CartillaCycle {
  if (!(CARTILLA_CYCLES as readonly number[]).includes(n)) {
    throw new BadRequestException('Elige 4, 6, 8, 10 o 12 ondas');
  }
  return n as CartillaCycle;
}

const MS_5_DAYS = 5 * 24 * 60 * 60 * 1000;

const CARTILLA_INCLUDE = {
  passDesign: true,
  items: { include: { promotion: true }, orderBy: { pointsRequired: 'asc' as const } },
} satisfies Prisma.CartillaInclude;

export type CartillaWithItems = Prisma.CartillaGetPayload<{
  include: typeof CARTILLA_INCLUDE;
}>;

export function assignmentCap(maxRedemptions: number | null | undefined) {
  if (maxRedemptions == null) return null;
  return Math.ceil(maxRedemptions * (1 + PROMO_ASSIGNMENT_TOLERANCE));
}

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CartillaService {
  private readonly logger = new Logger(CartillaService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(forwardRef(() => JobsService)) private jobs: JobsService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(BrevoService) private brevo: BrevoService
  ) {}

  async ensureDefaultCartilla(storeId: string, db: Db = this.prisma) {
    const existing = await db.cartilla.findFirst({
      where: { storeId, isDefault: true },
      include: CARTILLA_INCLUDE,
    });
    if (existing) {
      await this.attachStoreDesign(storeId, existing.id, db);
      return existing;
    }

    const store = await db.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { passDesign: true, promotions: true },
    });

    const cartilla = await db.cartilla.create({
      data: {
        storeId,
        name: 'Cartilla permanente',
        isDefault: true,
        status: 'ACTIVE',
        maxStamps: snapCartillaCycle(store.maxStamps || 12),
      },
    });

    await this.attachStoreDesign(storeId, cartilla.id, db, store.passDesign);

    const bySlot = new Map<string, Promotion>();
    for (const p of store.promotions) {
      if (!p.isActive || p.eventId) continue;
      if (!p.pointsRequired || p.pointsRequired < 1) continue;
      const pool = p.pool || 'RETENCION';
      const key = `${p.pointsRequired}:${pool}`;
      if (!bySlot.has(key)) bySlot.set(key, p);
    }
    for (const p of bySlot.values()) {
      await db.cartillaPromo.create({
        data: {
          cartillaId: cartilla.id,
          promotionId: p.id,
          pointsRequired: p.pointsRequired,
          pool: p.pool || 'RETENCION',
        },
      });
    }

    return db.cartilla.findUniqueOrThrow({
      where: { id: cartilla.id },
      include: CARTILLA_INCLUDE,
    });
  }

  private async attachStoreDesign(
    storeId: string,
    cartillaId: string,
    db: Db,
    existing?: PassDesign | null
  ) {
    const design =
      existing ||
      (await db.passDesign.findUnique({ where: { cartillaId } })) ||
      (await db.passDesign.findUnique({ where: { storeId } }));
    if (design) {
      if (design.cartillaId !== cartillaId) {
        await db.passDesign.update({
          where: { id: design.id },
          data: { cartillaId },
        });
      }
      return;
    }
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    await db.passDesign.create({
      data: {
        storeId,
        cartillaId,
        title: store.name,
        subtitle: 'Programa de lealtad Onda',
        description: 'Gana ondas en cada visita y canjea recompensas',
        backgroundColor: '#6E5AE6',
        foregroundColor: '#FFFFFF',
        labelColor: '#E5F6FC',
      },
    });
  }

  async resolveActiveCartilla(storeId: string): Promise<CartillaWithItems> {
    const def = await this.ensureDefaultCartilla(storeId);
    const now = new Date();
    const occasional = await this.prisma.cartilla.findFirst({
      where: { storeId, isDefault: false, status: 'ACTIVE' },
      include: CARTILLA_INCLUDE,
    });
    if (!occasional) return def;
    if (occasional.endsAt && occasional.endsAt < now) {
      await this.endCartilla(occasional.id);
      return this.ensureDefaultCartilla(storeId);
    }
    if (occasional.startsAt && occasional.startsAt > now) return def;
    return occasional;
  }

  async get(id: string) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id },
      include: CARTILLA_INCLUDE,
    });
    if (!cartilla) throw new NotFoundException('Cartilla no encontrada');
    return cartilla;
  }

  async list(storeId: string) {
    await this.ensureDefaultCartilla(storeId);
    const [items, active] = await Promise.all([
      this.prisma.cartilla.findMany({
        where: { storeId },
        include: CARTILLA_INCLUDE,
        orderBy: [{ isDefault: 'desc' }, { startsAt: 'asc' }, { createdAt: 'desc' }],
      }),
      this.resolveActiveCartilla(storeId),
    ]);
    return { cartillas: items, activeId: active.id };
  }

  async calendar(storeId: string, year: number) {
    await this.ensureDefaultCartilla(storeId);
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    const cartillas = await this.prisma.cartilla.findMany({
      where: {
        storeId,
        OR: [
          { isDefault: true },
          {
            startsAt: { lte: to },
            endsAt: { gte: from },
          },
          { startsAt: { gte: from, lte: to } },
        ],
      },
      include: CARTILLA_INCLUDE,
      orderBy: { startsAt: 'asc' },
    });
    const active = await this.resolveActiveCartilla(storeId);
    return { year, cartillas, activeId: active.id };
  }

  async create(body: {
    storeId: string;
    name: string;
    isDefault?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    maxStamps?: number;
    items?: Array<{ promotionId: string; pointsRequired: number }>;
  }) {
    if (body.isDefault) {
      const exists = await this.prisma.cartilla.findFirst({
        where: { storeId: body.storeId, isDefault: true },
      });
      if (exists) {
        throw new BadRequestException('Esta tienda ya tiene cartilla por defecto');
      }
    }
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    await this.ensureDefaultCartilla(body.storeId);
    const def = await this.prisma.cartilla.findFirstOrThrow({
      where: { storeId: body.storeId, isDefault: true },
      include: { passDesign: true },
    });

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (!body.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior al inicio');
    }

    const maxStamps = assertCycle(
      body.maxStamps ?? snapCartillaCycle(store.maxStamps || 12)
    );

    const cloned = def.passDesign;
    const cartilla = await this.prisma.cartilla.create({
      data: {
        storeId: body.storeId,
        name: body.name?.trim() || 'Cartilla',
        isDefault: Boolean(body.isDefault),
        status: body.isDefault ? 'ACTIVE' : 'DRAFT',
        startsAt,
        endsAt,
        maxStamps,
        passDesign: {
          create: {
            title: cloned?.title || store.name,
            subtitle: cloned?.subtitle,
            description: cloned?.description,
            backgroundColor: cloned?.backgroundColor || '#6E5AE6',
            foregroundColor: cloned?.foregroundColor || '#FFFFFF',
            labelColor: cloned?.labelColor,
            logoUrl: cloned?.logoUrl,
            stripImageUrl: cloned?.stripImageUrl,
          },
        },
      },
    });

    await this.replacePromos(cartilla.id, body.items || [], maxStamps);
    if (endsAt) await this.scheduleEndingSms(cartilla.id);
    await this.maybeSyncStoreCycle(body.storeId, cartilla.id, maxStamps);
    return this.get(cartilla.id);
  }

  async update(
    id: string,
    body: {
      name?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      maxStamps?: number;
      items?: Array<{ promotionId: string; pointsRequired: number }>;
    }
  ) {
    const cartilla = await this.get(id);
    const startsAt =
      body.startsAt !== undefined
        ? body.startsAt
          ? new Date(body.startsAt)
          : null
        : cartilla.startsAt;
    const endsAt =
      body.endsAt !== undefined
        ? body.endsAt
          ? new Date(body.endsAt)
          : null
        : cartilla.endsAt;
    if (!cartilla.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior al inicio');
    }
    if (cartilla.isDefault && (body.startsAt || body.endsAt)) {
      throw new BadRequestException('La cartilla por defecto no usa fechas');
    }

    const maxStamps =
      body.maxStamps != null ? assertCycle(body.maxStamps) : cartilla.maxStamps;

    await this.prisma.cartilla.update({
      where: { id },
      data: {
        ...('name' in body && body.name ? { name: body.name.trim() } : {}),
        ...(body.startsAt !== undefined ? { startsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt, smsRemindedAt: null } : {}),
        ...(body.maxStamps != null ? { maxStamps } : {}),
      },
    });
    if (body.items) {
      await this.replacePromos(id, body.items, maxStamps);
    } else if (body.maxStamps != null) {
      await this.dropSlotsOverCycle(id, maxStamps);
    }
    if (endsAt) await this.scheduleEndingSms(id);
    await this.maybeSyncStoreCycle(cartilla.storeId, id, maxStamps);
    return this.get(id);
  }

  async activate(id: string) {
    const cartilla = await this.get(id);
    if (cartilla.isDefault) {
      throw new BadRequestException('La cartilla por defecto ya está activa como fallback');
    }
    if (!cartilla.endsAt) {
      throw new BadRequestException('Indica una fecha de fin antes de activar');
    }
    const others = await this.prisma.cartilla.findMany({
      where: {
        storeId: cartilla.storeId,
        isDefault: false,
        status: 'ACTIVE',
        id: { not: id },
      },
    });
    for (const other of others) {
      await this.endCartilla(other.id, { skipReset: true });
    }
    await this.prisma.cartilla.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startsAt: cartilla.startsAt && cartilla.startsAt < new Date()
          ? cartilla.startsAt
          : new Date(),
      },
    });
    await this.prisma.store.update({
      where: { id: cartilla.storeId },
      data: { maxStamps: cartilla.maxStamps },
    });
    await this.resetStorePasses(cartilla.storeId, id);
    await this.scheduleEndingSms(id);
    return this.get(id);
  }

  async endCartilla(id: string, opts?: { skipReset?: boolean }) {
    const cartilla = await this.prisma.cartilla.findUnique({ where: { id } });
    if (!cartilla) throw new NotFoundException('Cartilla no encontrada');
    if (cartilla.isDefault) {
      throw new BadRequestException('No se puede terminar la cartilla por defecto');
    }
    await this.prisma.cartilla.update({
      where: { id },
      data: { status: 'ENDED' },
    });
    if (!opts?.skipReset) {
      const def = await this.ensureDefaultCartilla(cartilla.storeId);
      await this.prisma.store.update({
        where: { id: cartilla.storeId },
        data: { maxStamps: def.maxStamps },
      });
      await this.resetStorePasses(cartilla.storeId, def.id);
    }
    return this.get(id);
  }

  async resetStorePasses(storeId: string, cartillaId: string) {
    const passes = await this.prisma.pass.findMany({ where: { storeId } });
    for (const pass of passes) {
      await this.prisma.pass.update({
        where: { id: pass.id },
        data: {
          cartillaId,
          points: 0,
          cycleStartedAt: new Date(),
        },
      });
      await this.assignPassPromos(pass.id);
      if (pass.walletRef) {
        await this.wallet.updatePoints(pass.walletRef, 0);
        const message = 'Tu cartilla de Onda se actualizó. El ciclo de ondas empieza de nuevo.';
        await this.wallet.notify(pass.walletRef, message);
      }
    }
  }

  async assignPassPromos(passId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (!pass.storeId) return [];

    const active = await this.resolveActiveCartilla(pass.storeId);
    if (pass.cartillaId !== active.id) {
      await this.prisma.pass.update({
        where: { id: passId },
        data: { cartillaId: active.id },
      });
    }

    const accumulateCount = await this.prisma.transaction.count({
      where: { passId, storeId: pass.storeId, type: 'ACCUMULATE' },
    });
    const pool: PromotionPool =
      accumulateCount > 0 ? 'RETENCION' : 'BIENVENIDA';

    const items = active.items.filter(
      (i) => i.pool === pool && i.pointsRequired <= active.maxStamps
    );
    const assigned: { pointsRequired: number; promotionId: string }[] = [];

    for (const item of items) {
      const promo = item.promotion;
      if (!promo.isActive) continue;
      const redemptions = await this.prisma.transaction.count({
        where: { promotionId: promo.id, type: 'REDEEM' },
      });
      if (promo.maxRedemptions != null && redemptions >= promo.maxRedemptions) {
        continue;
      }
      const cap = assignmentCap(promo.maxRedemptions);
      if (cap != null) {
        const live = await this.prisma.passPromoAssignment.count({
          where: { promotionId: promo.id, cartillaId: active.id },
        });
        if (live >= cap) continue;
      }
      await this.prisma.passPromoAssignment.upsert({
        where: {
          passId_cartillaId_pointsRequired: {
            passId,
            cartillaId: active.id,
            pointsRequired: item.pointsRequired,
          },
        },
        create: {
          passId,
          cartillaId: active.id,
          promotionId: promo.id,
          pointsRequired: item.pointsRequired,
        },
        update: { promotionId: promo.id },
      });
      assigned.push({ pointsRequired: item.pointsRequired, promotionId: promo.id });
    }
    return assigned;
  }

  async assertCanRedeem(passId: string, promotionId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({ where: { id: passId } });
    const promo = await this.prisma.promotion.findUniqueOrThrow({
      where: { id: promotionId },
    });
    if (!pass.storeId || promo.storeId !== pass.storeId) {
      throw new BadRequestException('Promoción no pertenece a este negocio');
    }
    if (!promo.isActive) {
      throw new BadRequestException('Promoción inactiva');
    }
    const assignment = await this.prisma.passPromoAssignment.findFirst({
      where: {
        passId,
        promotionId,
        cartillaId: pass.cartillaId || undefined,
      },
    });
    if (!assignment) {
      throw new BadRequestException('Esta promo no está en tu cartilla');
    }
    if (promo.maxRedemptions != null) {
      const used = await this.prisma.transaction.count({
        where: { promotionId: promo.id, type: 'REDEEM' },
      });
      if (used >= promo.maxRedemptions) {
        throw new BadRequestException('Se agotaron las redenciones de esta promo');
      }
    }
    if (pass.points < assignment.pointsRequired) {
      throw new BadRequestException('Aún no alcanzas este premio');
    }
    return { pass, promo, assignment };
  }

  async canMovePool(promotionId: string) {
    const links = await this.prisma.cartillaPromo.findMany({
      where: { promotionId },
      select: { cartillaId: true },
    });
    if (!links.length) return true;
    const counts = await this.prisma.pass.groupBy({
      by: ['cartillaId'],
      where: { cartillaId: { in: links.map((l) => l.cartillaId) } },
      _count: { _all: true },
    });
    return !counts.some((c) => c._count._all > 0);
  }

  async stockAlerts(storeId: string) {
    const active = await this.resolveActiveCartilla(storeId);
    const alerts: Array<{
      promotionId: string;
      title: string;
      pointsRequired: number;
      pool: PromotionPool;
      remaining: number | null;
      assignmentCount: number;
      assignmentCap: number | null;
    }> = [];
    for (const item of active.items) {
      const p = item.promotion;
      if (p.maxRedemptions == null) continue;
      const redemptions = await this.prisma.transaction.count({
        where: { promotionId: p.id, type: 'REDEEM' },
      });
      const remaining = Math.max(0, p.maxRedemptions - redemptions);
      const cap = assignmentCap(p.maxRedemptions);
      const assignmentCount = await this.prisma.passPromoAssignment.count({
        where: { promotionId: p.id, cartillaId: active.id },
      });
      const exhausted =
        remaining <= 0 || (cap != null && assignmentCount >= cap);
      if (exhausted) {
        alerts.push({
          promotionId: p.id,
          title: p.title,
          pointsRequired: item.pointsRequired,
          pool: item.pool,
          remaining,
          assignmentCount,
          assignmentCap: cap,
        });
      }
    }
    return alerts;
  }

  async scheduleEndingSms(cartillaId: string) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id: cartillaId },
    });
    if (!cartilla?.endsAt || cartilla.isDefault) return;
    const delayMs = cartilla.endsAt.getTime() - MS_5_DAYS - Date.now();
    await this.jobs.enqueue(
      'cartilla-ending-sms',
      {
        cartillaId: cartilla.id,
        storeId: cartilla.storeId,
        endsAt: cartilla.endsAt.toISOString(),
      },
      { delayMs: Math.max(0, delayMs) }
    );
  }

  async sendEndingSms(payload: {
    cartillaId: string;
    storeId: string;
    endsAt: string;
  }) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id: payload.cartillaId },
      include: { store: true },
    });
    if (!cartilla || cartilla.status === 'ENDED') return;
    if (!cartilla.endsAt) return;
    if (cartilla.endsAt.toISOString() !== payload.endsAt) {
      this.logger.log(`SMS cartilla ${cartilla.id} omitido: endsAt cambió`);
      return;
    }
    if (cartilla.smsRemindedAt) return;

    const endsLabel = cartilla.endsAt.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
    });
    const message =
      `${cartilla.store.name}: tienes hasta el ${endsLabel} para acumular y redimir en tu cartilla.`.slice(
        0,
        160
      );

    const passes = await this.prisma.pass.findMany({
      where: { storeId: cartilla.storeId, cartillaId: cartilla.id },
      include: { user: true },
    });
    const phones = [...new Set(passes.map((p) => p.user.phone).filter(Boolean))];
    for (const to of phones) {
      await this.brevo.sendSms({ to, message });
    }
    await this.prisma.cartilla.update({
      where: { id: cartilla.id },
      data: { smsRemindedAt: new Date() },
    });
    this.logger.log(`SMS fin de cartilla ${cartilla.id} n=${phones.length}`);
  }

  private async maybeSyncStoreCycle(
    storeId: string,
    cartillaId: string,
    maxStamps: number
  ) {
    const active = await this.resolveActiveCartilla(storeId);
    if (active.id !== cartillaId) return;
    await this.prisma.store.update({
      where: { id: storeId },
      data: { maxStamps },
    });
  }

  private async dropSlotsOverCycle(cartillaId: string, maxStamps: number) {
    await this.prisma.cartillaPromo.deleteMany({
      where: { cartillaId, pointsRequired: { gt: maxStamps } },
    });
  }

  private async replacePromos(
    cartillaId: string,
    items: Array<{ promotionId: string; pointsRequired: number }>,
    maxStamps: number
  ) {
    await this.prisma.cartillaPromo.deleteMany({ where: { cartillaId } });
    if (!items.length) return;

    const uniqueIds = [...new Set(items.map((i) => i.promotionId).filter(Boolean))];
    const promos = await this.prisma.promotion.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (promos.length !== uniqueIds.length) {
      throw new BadRequestException('Alguna promoción no existe');
    }
    const byId = new Map(promos.map((p) => [p.id, p]));
    const used = new Set<string>();
    const seenPromo = new Set<string>();

    for (const item of items) {
      const promo = byId.get(item.promotionId);
      if (!promo) continue;
      if (seenPromo.has(promo.id)) {
        throw new BadRequestException(
          `La promo «${promo.title}» ya está en esta cartilla`
        );
      }
      seenPromo.add(promo.id);
      const n = Number(item.pointsRequired);
      if (!Number.isInteger(n) || n < 1 || n > maxStamps) {
        throw new BadRequestException(
          `Elige una onda entre 1 y ${maxStamps} para «${promo.title}»`
        );
      }
      const pool = promo.pool || 'RETENCION';
      const key = `${n}:${pool}`;
      if (used.has(key)) {
        throw new BadRequestException(
          `Ya hay una promo de ${pool === 'BIENVENIDA' ? 'Adquisición' : 'Retención'} en la onda ${n}`
        );
      }
      used.add(key);
      await this.prisma.cartillaPromo.create({
        data: {
          cartillaId,
          promotionId: promo.id,
          pointsRequired: n,
          pool,
        },
      });
    }
  }
}

