import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  PromotionPool,
  type PassDesign,
  type Promotion,
} from "@prisma/client";
import {
  cartillaCoversToday,
  formatCartillaDay,
  parseCartillaDay,
  todayBogotaKey,
  computeRoi,
} from "@onda/shared-utils";
import { PrismaService } from "./prisma.service";
import { WalletService } from "./wallet.service";
import { paletteFromStoreBrand } from "./pass-design.util";

export const PROMO_ASSIGNMENT_TOLERANCE = 0.15;
export const CARTILLA_CYCLES = [2, 4, 6, 8, 10, 12] as const;
export type CartillaCycle = (typeof CARTILLA_CYCLES)[number];

export function snapCartillaCycle(n: number): CartillaCycle {
  if ((CARTILLA_CYCLES as readonly number[]).includes(n))
    return n as CartillaCycle;
  return CARTILLA_CYCLES.reduce((best, x) =>
    Math.abs(x - n) < Math.abs(best - n) ? x : best,
  );
}

function assertCycle(n: number): CartillaCycle {
  if (!(CARTILLA_CYCLES as readonly number[]).includes(n)) {
    throw new BadRequestException("Elige 2, 4, 6, 8, 10 o 12 ondas");
  }
  return n as CartillaCycle;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

function parseOptionalDay(raw?: string | null): Date | null {
  if (!raw) return null;
  return parseCartillaDay(raw);
}

const CARTILLA_INCLUDE = {
  passDesign: true,
  items: {
    include: { promotion: true },
    orderBy: { pointsRequired: "asc" as const },
  },
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
    @Inject(WalletService) private wallet: WalletService,
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
        name: "Cartilla base",
        isDefault: true,
        status: "ACTIVE",
        maxStamps: snapCartillaCycle(store.maxStamps || 12),
      },
    });

    await this.attachStoreDesign(storeId, cartilla.id, db, store.passDesign);

    const bySlot = new Map<string, Promotion>();
    for (const p of store.promotions) {
      if (!p.isActive || p.eventId) continue;
      if (!p.pointsRequired || p.pointsRequired < 1) continue;
      const pool = p.pool || "RETENCION";
      const key = `${p.pointsRequired}:${pool}`;
      if (!bySlot.has(key)) bySlot.set(key, p);
    }
    for (const p of bySlot.values()) {
      await db.cartillaPromo.create({
        data: {
          cartillaId: cartilla.id,
          promotionId: p.id,
          pointsRequired: p.pointsRequired,
          pool: p.pool || "RETENCION",
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
    existing?: PassDesign | null,
  ) {
    const cartillaDesign = await db.passDesign.findUnique({
      where: { cartillaId },
    });
    if (cartillaDesign) return;

    const storeDesign =
      existing ??
      (await db.passDesign.findUnique({ where: { storeId } }));

    // Legacy: un solo registro servía store + cartilla — separar copiando a la cartilla.
    if (storeDesign?.cartillaId === cartillaId) {
      await db.passDesign.create({
        data: {
          cartillaId,
          title: storeDesign.title,
          subtitle: storeDesign.subtitle,
          description: storeDesign.description,
          backgroundColor: storeDesign.backgroundColor,
          foregroundColor: storeDesign.foregroundColor,
          labelColor: storeDesign.labelColor,
          logoUrl: storeDesign.logoUrl,
          stripImageUrl: storeDesign.stripImageUrl,
        },
      });
      await db.passDesign.update({
        where: { id: storeDesign.id },
        data: { cartillaId: null },
      });
      return;
    }

    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    const palette = paletteFromStoreBrand(storeDesign);
    await db.passDesign.create({
      data: {
        cartillaId,
        title: storeDesign?.title ?? store.name,
        subtitle: storeDesign?.subtitle ?? "Programa de lealtad Onda",
        description:
          storeDesign?.description ??
          "Gana ondas en cada visita y canjea recompensas",
        backgroundColor: palette.backgroundColor,
        foregroundColor: palette.foregroundColor,
        labelColor: palette.labelColor,
        logoUrl: storeDesign?.logoUrl ?? null,
        stripImageUrl: storeDesign?.stripImageUrl ?? null,
      },
    });
  }

  /**
   * Propaga logo y colores de marca a cartillas que siguen la paleta global.
   * La cartilla base siempre se actualiza. Las ocasionales, solo si aún tenían
   * el logo/colores anteriores del negocio (no un diseño propio).
   */
  async syncStoreBrand(
    storeId: string,
    next: {
      logoUrl?: string | null;
      stripImageUrl?: string | null;
      backgroundColor: string;
      foregroundColor: string;
      labelColor: string;
    },
    prev?: {
      logoUrl?: string | null;
      stripImageUrl?: string | null;
      backgroundColor?: string | null;
      labelColor?: string | null;
    } | null,
  ) {
    const cartillas = await this.prisma.cartilla.findMany({
      where: { storeId },
      include: { passDesign: true },
    });
    const prevBg = prev?.backgroundColor?.trim().toUpperCase() || "";
    const prevLabel = prev?.labelColor?.trim().toUpperCase() || "";
    const prevLogo = prev?.logoUrl?.trim() || "";
    const prevStrip = prev?.stripImageUrl?.trim() || "";

    for (const cartilla of cartillas) {
      if (!cartilla.passDesign) {
        await this.attachStoreDesign(storeId, cartilla.id, this.prisma);
        continue;
      }
      const design = cartilla.passDesign;
      const samePalette =
        cartilla.isDefault ||
        !prevBg ||
        (design.backgroundColor.trim().toUpperCase() === prevBg &&
          (design.labelColor || "").trim().toUpperCase() === prevLabel);
      const sameLogo =
        cartilla.isDefault ||
        !prevLogo ||
        !(design.logoUrl || "").trim() ||
        (design.logoUrl || "").trim() === prevLogo;
      const sameStrip =
        cartilla.isDefault ||
        !prevStrip ||
        !(design.stripImageUrl || "").trim() ||
        (design.stripImageUrl || "").trim() === prevStrip;

      if (!samePalette && !sameLogo && !sameStrip) continue;

      await this.prisma.passDesign.update({
        where: { id: design.id },
        data: {
          ...(samePalette
            ? {
                backgroundColor: next.backgroundColor,
                foregroundColor: next.foregroundColor,
                labelColor: next.labelColor,
              }
            : {}),
          ...(sameLogo && next.logoUrl !== undefined
            ? { logoUrl: next.logoUrl }
            : {}),
          ...(sameStrip && next.stripImageUrl !== undefined
            ? { stripImageUrl: next.stripImageUrl }
            : {}),
        },
      });
    }
  }

  async resolveActiveCartilla(storeId: string): Promise<CartillaWithItems> {
    const def = await this.ensureDefaultCartilla(storeId);
    const now = new Date();
    const occasionals = await this.prisma.cartilla.findMany({
      where: { storeId, isDefault: false, status: { not: "ENDED" } },
      include: CARTILLA_INCLUDE,
      orderBy: { startsAt: "desc" },
    });

    const live: CartillaWithItems[] = [];
    let endedApplied = false;
    for (const cartilla of occasionals) {
      const hasWindow = Boolean(cartilla.startsAt && cartilla.endsAt);
      if (hasWindow) {
        const stillOpen = cartillaCoversToday(null, cartilla.endsAt, now);
        if (!stillOpen) {
          const wasActive = cartilla.status === "ACTIVE";
          await this.endCartilla(cartilla.id, { skipReset: true });
          if (wasActive) endedApplied = true;
          continue;
        }
        if (!cartillaCoversToday(cartilla.startsAt, cartilla.endsAt, now)) {
          continue;
        }
        live.push(cartilla);
        continue;
      }
      if (cartilla.status === "ACTIVE") live.push(cartilla);
    }

    for (const extra of live.slice(1)) {
      await this.endCartilla(extra.id, { skipReset: true });
    }

    if (live[0]) {
      const next = live[0];
      const becameLive = next.status !== "ACTIVE";
      if (becameLive) {
        await this.prisma.cartilla.update({
          where: { id: next.id },
          data: { status: "ACTIVE" },
        });
      }
      if (becameLive || endedApplied || live.length > 1) {
        await this.prisma.store.update({
          where: { id: storeId },
          data: { maxStamps: next.maxStamps },
        });
        await this.resetStorePasses(storeId, next.id);
      }
      return this.prisma.cartilla.findUniqueOrThrow({
        where: { id: next.id },
        include: CARTILLA_INCLUDE,
      });
    }

    if (endedApplied) {
      await this.prisma.store.update({
        where: { id: storeId },
        data: { maxStamps: def.maxStamps },
      });
      await this.resetStorePasses(storeId, def.id);
    }
    return def;
  }

  async syncPassCartilla(passId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (!pass.storeId) {
      return { switched: false, active: null as CartillaWithItems | null };
    }
    const active = await this.resolveActiveCartilla(pass.storeId);
    const current = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (current.cartillaId === active.id) {
      return { switched: false, active };
    }
    await this.prisma.pass.update({
      where: { id: passId },
      data: {
        cartillaId: active.id,
        points: 0,
        cycleStartedAt: new Date(),
      },
    });
    await this.assignPassPromos(passId);
    if (current.walletRef) {
      const until = active.endsAt
        ? ` Tienes hasta el ${formatCartillaDay(active.endsAt)} para acumular y redimir.`
        : " El ciclo de ondas empieza de nuevo.";
      await this.wallet.updatePoints(
        current.walletRef,
        0,
        `Tu cartilla de Onda se actualizó.${until}`,
      );
    }
    return { switched: true, active };
  }

  private async assertNoOccasionalOverlap(
    storeId: string,
    startsAt: Date | null,
    endsAt: Date | null,
    excludeId?: string,
  ) {
    if (!startsAt || !endsAt) return;
    const others = await this.prisma.cartilla.findMany({
      where: {
        storeId,
        isDefault: false,
        status: { not: "ENDED" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const other of others) {
      if (!other.startsAt || !other.endsAt) continue;
      if (rangesOverlap(startsAt, endsAt, other.startsAt, other.endsAt)) {
        throw new BadRequestException(
          `El rango se cruza con «${other.name}». Solo puede haber una cartilla ocasional a la vez.`,
        );
      }
    }
  }

  async passCount(cartillaId: string) {
    return this.prisma.pass.count({ where: { cartillaId } });
  }

  private async withLock<T extends { id: string }>(cartilla: T) {
    const passCount = await this.passCount(cartilla.id);
    return { ...cartilla, passCount, locked: false };
  }

  async get(id: string) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id },
      include: CARTILLA_INCLUDE,
    });
    if (!cartilla) throw new NotFoundException("Cartilla no encontrada");
    await this.resolveActiveCartilla(cartilla.storeId);
    const fresh = await this.prisma.cartilla.findUniqueOrThrow({
      where: { id },
      include: CARTILLA_INCLUDE,
    });
    return this.withLock(fresh);
  }

  async list(storeId: string) {
    await this.ensureDefaultCartilla(storeId);
    const [items, active] = await Promise.all([
      this.prisma.cartilla.findMany({
        where: { storeId },
        include: CARTILLA_INCLUDE,
        orderBy: [
          { isDefault: "desc" },
          { startsAt: "asc" },
          { createdAt: "desc" },
        ],
      }),
      this.resolveActiveCartilla(storeId),
    ]);
    const counts = await this.prisma.pass.groupBy({
      by: ["cartillaId"],
      where: { storeId, cartillaId: { not: null } },
      _count: { _all: true },
    });
    const byId = new Map(counts.map((c) => [c.cartillaId, c._count._all]));
    const txRows = await this.prisma.transaction.groupBy({
      by: ["cartillaId", "type"],
      where: {
        storeId,
        cartillaId: { not: null },
        type: { in: ["ACCUMULATE", "REDEEM"] },
      },
      _count: { _all: true },
      _sum: { paymentAmount: true, benefitAmount: true },
    });
    const txById = new Map<
      string,
      {
        accumulations: number;
        redemptions: number;
        ventas: number;
        beneficioOtorgado: number;
      }
    >();
    for (const row of txRows) {
      if (!row.cartillaId) continue;
      const cur = txById.get(row.cartillaId) || {
        accumulations: 0,
        redemptions: 0,
        ventas: 0,
        beneficioOtorgado: 0,
      };
      if (row.type === "ACCUMULATE") {
        cur.accumulations = row._count._all;
        cur.ventas = row._sum.paymentAmount ?? 0;
      }
      if (row.type === "REDEEM") {
        cur.redemptions = row._count._all;
        cur.beneficioOtorgado = row._sum.benefitAmount ?? 0;
      }
      txById.set(row.cartillaId, cur);
    }
    return {
      cartillas: items.map((c) => {
        const passCount = byId.get(c.id) || 0;
        const tx = txById.get(c.id) || {
          accumulations: 0,
          redemptions: 0,
          ventas: 0,
          beneficioOtorgado: 0,
        };
        return {
          ...c,
          passCount,
          locked: false,
          promoCount: c.items.length,
          accumulations: tx.accumulations,
          redemptions: tx.redemptions,
          ventas: tx.ventas,
          beneficioOtorgado: tx.beneficioOtorgado,
          roi: computeRoi(tx.ventas, tx.beneficioOtorgado),
        };
      }),
      activeId: active.id,
    };
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
      orderBy: { startsAt: "asc" },
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
        throw new BadRequestException("Esta tienda ya tiene cartilla base");
      }
    }
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
      include: { passDesign: true },
    });
    await this.ensureDefaultCartilla(body.storeId);
    const def = await this.prisma.cartilla.findFirstOrThrow({
      where: { storeId: body.storeId, isDefault: true },
      include: { passDesign: true },
    });

    const startsAt = parseOptionalDay(body.startsAt);
    const endsAt = parseOptionalDay(body.endsAt);
    if (!body.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        "La fecha de fin debe ser posterior al inicio",
      );
    }
    if (!body.isDefault) {
      await this.assertNoOccasionalOverlap(body.storeId, startsAt, endsAt);
    }

    const maxStamps = assertCycle(
      body.maxStamps ?? snapCartillaCycle(store.maxStamps || 12),
    );

    const cloned = def.passDesign;
    const brand = paletteFromStoreBrand(store.passDesign);
    const storeLogo = store.passDesign?.logoUrl?.trim() || null;
    const cartillaLogo = cloned?.logoUrl?.trim() || storeLogo;
    const cartilla = await this.prisma.cartilla.create({
      data: {
        storeId: body.storeId,
        name: body.name?.trim() || "Cartilla",
        isDefault: Boolean(body.isDefault),
        status: body.isDefault ? "ACTIVE" : "DRAFT",
        startsAt,
        endsAt,
        maxStamps,
        passDesign: {
          create: {
            title: cloned?.title || store.name,
            subtitle: cloned?.subtitle,
            description: cloned?.description,
            backgroundColor: brand.backgroundColor,
            foregroundColor: brand.foregroundColor,
            labelColor: brand.labelColor,
            logoUrl: cartillaLogo,
            stripImageUrl: cloned?.stripImageUrl,
          },
        },
      },
    });

    await this.replacePromos(cartilla.id, body.items || [], maxStamps);
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
    },
  ) {
    const cartilla = await this.get(id);
    const startsAt =
      body.startsAt !== undefined
        ? parseOptionalDay(body.startsAt)
        : cartilla.startsAt;
    const endsAt =
      body.endsAt !== undefined
        ? parseOptionalDay(body.endsAt)
        : cartilla.endsAt;
    if (!cartilla.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        "La fecha de fin debe ser posterior al inicio",
      );
    }
    if (cartilla.isDefault && (body.startsAt || body.endsAt)) {
      throw new BadRequestException("La cartilla base no usa fechas");
    }
    if (!cartilla.isDefault) {
      await this.assertNoOccasionalOverlap(
        cartilla.storeId,
        startsAt,
        endsAt,
        id,
      );
    }

    const maxStamps =
      body.maxStamps != null ? assertCycle(body.maxStamps) : cartilla.maxStamps;

    await this.prisma.cartilla.update({
      where: { id },
      data: {
        ...("name" in body && body.name ? { name: body.name.trim() } : {}),
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
    await this.maybeSyncStoreCycle(cartilla.storeId, id, maxStamps);

    const itemsChanged = Boolean(body.items);
    const cycleChanged =
      body.maxStamps != null && body.maxStamps !== cartilla.maxStamps;
    const datesChanged =
      body.startsAt !== undefined || body.endsAt !== undefined;
    if (itemsChanged || cycleChanged) {
      await this.resyncLiveAssignments(id);
    }
    const active = await this.resolveActiveCartilla(cartilla.storeId);
    if (active.id === id && (itemsChanged || cycleChanged || datesChanged)) {
      await this.pushCartillaWallets(
        id,
        itemsChanged || cycleChanged
          ? "Tu cartilla de Onda se actualizó."
          : undefined,
      );
    }
    return this.get(id);
  }

  async pushCartillaWallets(cartillaId: string, message?: string) {
    const passes = await this.prisma.pass.findMany({
      where: { cartillaId, walletRef: { not: null } },
      select: { walletRef: true, points: true },
    });
    for (const pass of passes) {
      if (!pass.walletRef) continue;
      await this.wallet.updatePoints(pass.walletRef, pass.points, message);
    }
  }

  private async resyncLiveAssignments(cartillaId: string) {
    const cartilla = await this.prisma.cartilla.findUnique({
      where: { id: cartillaId },
    });
    if (!cartilla) return;
    const active = await this.resolveActiveCartilla(cartilla.storeId);
    if (active.id !== cartillaId) return;

    await this.prisma.passPromoAssignment.deleteMany({ where: { cartillaId } });
    const passes = await this.prisma.pass.findMany({ where: { cartillaId } });
    for (const pass of passes) {
      if (pass.points > cartilla.maxStamps) {
        await this.prisma.pass.update({
          where: { id: pass.id },
          data: { points: cartilla.maxStamps },
        });
      }
      await this.assignPassPromos(pass.id);
    }
  }

  async activate(id: string) {
    const cartilla = await this.get(id);
    if (cartilla.isDefault) {
      throw new BadRequestException(
        "La cartilla base ya está vigente cuando no hay una ocasional activa",
      );
    }
    if (cartilla.status === "ACTIVE") {
      return cartilla;
    }
    if (!cartilla.endsAt) {
      throw new BadRequestException("Indica una fecha de fin antes de activar");
    }
    const others = await this.prisma.cartilla.findMany({
      where: {
        storeId: cartilla.storeId,
        isDefault: false,
        status: "ACTIVE",
        id: { not: id },
      },
    });
    for (const other of others) {
      await this.endCartilla(other.id, { skipReset: true });
    }
    const startsAt =
      cartilla.startsAt && cartillaCoversToday(cartilla.startsAt, null)
        ? cartilla.startsAt
        : parseCartillaDay(todayBogotaKey());
    await this.assertNoOccasionalOverlap(
      cartilla.storeId,
      startsAt,
      cartilla.endsAt,
      id,
    );
    await this.prisma.cartilla.update({
      where: { id },
      data: {
        status: "ACTIVE",
        startsAt,
      },
    });
    await this.prisma.store.update({
      where: { id: cartilla.storeId },
      data: { maxStamps: cartilla.maxStamps },
    });
    await this.resetStorePasses(cartilla.storeId, id);
    return this.get(id);
  }

  async endCartilla(id: string, opts?: { skipReset?: boolean }) {
    const cartilla = await this.prisma.cartilla.findUnique({ where: { id } });
    if (!cartilla) throw new NotFoundException("Cartilla no encontrada");
    if (cartilla.isDefault) {
      throw new BadRequestException("No se puede terminar la cartilla base");
    }
    await this.prisma.cartilla.update({
      where: { id },
      data: { status: "ENDED" },
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
    const next = await this.prisma.cartilla.findUnique({
      where: { id: cartillaId },
    });
    const message = next?.endsAt
      ? `Tu cartilla de Onda se actualizó. Tienes hasta el ${formatCartillaDay(next.endsAt)} para acumular y redimir.`
      : "Tu cartilla de Onda se actualizó. El ciclo de ondas empieza de nuevo.";
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
        await this.wallet.updatePoints(pass.walletRef, 0, message);
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
      where: { passId, storeId: pass.storeId, type: "ACCUMULATE" },
    });
    const pool: PromotionPool =
      accumulateCount > 0 ? "RETENCION" : "BIENVENIDA";

    const items = active.items.filter(
      (i) => i.pool === pool && i.pointsRequired <= active.maxStamps,
    );
    const assigned: { pointsRequired: number; promotionId: string }[] = [];

    for (const item of items) {
      const promo = item.promotion;
      if (!promo.isActive) continue;
      const redemptions = await this.prisma.transaction.count({
        where: { promotionId: promo.id, type: "REDEEM" },
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
      assigned.push({
        pointsRequired: item.pointsRequired,
        promotionId: promo.id,
      });
    }
    return assigned;
  }

  async assertCanRedeem(passId: string, promotionId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    const promo = await this.prisma.promotion.findUniqueOrThrow({
      where: { id: promotionId },
    });
    if (!pass.storeId || promo.storeId !== pass.storeId) {
      throw new BadRequestException("Promoción no pertenece a este negocio");
    }
    if (!promo.isActive) {
      throw new BadRequestException("Promoción inactiva");
    }
    if (pass.storeId) {
      const active = await this.resolveActiveCartilla(pass.storeId);
      if (pass.cartillaId !== active.id) {
        throw new BadRequestException(
          "Tu cartilla se actualizó. Recarga para ver la vigente.",
        );
      }
    }
    const assignment = await this.prisma.passPromoAssignment.findFirst({
      where: {
        passId,
        promotionId,
        cartillaId: pass.cartillaId || undefined,
      },
    });
    if (!assignment) {
      throw new BadRequestException("Esta promo no está en tu cartilla");
    }
    if (promo.maxRedemptions != null) {
      const used = await this.prisma.transaction.count({
        where: { promotionId: promo.id, type: "REDEEM" },
      });
      if (used >= promo.maxRedemptions) {
        throw new BadRequestException(
          "Se agotaron las redenciones de esta promo",
        );
      }
    }
    if (pass.points < assignment.pointsRequired) {
      throw new BadRequestException("Aún no alcanzas este premio");
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
      by: ["cartillaId"],
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
        where: { promotionId: p.id, type: "REDEEM" },
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

  async sendEndingSms(_payload: {
    cartillaId: string;
    storeId: string;
    endsAt: string;
  }) {
    this.logger.log('SMS fin de cartilla omitido: solo registro y campañas a demanda');
  }

  private async maybeSyncStoreCycle(
    storeId: string,
    cartillaId: string,
    maxStamps: number,
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
    maxStamps: number,
  ) {
    await this.prisma.cartillaPromo.deleteMany({ where: { cartillaId } });
    if (!items.length) return;

    const uniqueIds = [
      ...new Set(items.map((i) => i.promotionId).filter(Boolean)),
    ];
    const promos = await this.prisma.promotion.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (promos.length !== uniqueIds.length) {
      throw new BadRequestException("Alguna promoción no existe");
    }
    const byId = new Map(promos.map((p) => [p.id, p]));
    const used = new Set<string>();
    const seenPromo = new Set<string>();

    for (const item of items) {
      const promo = byId.get(item.promotionId);
      if (!promo) continue;
      if (seenPromo.has(promo.id)) {
        throw new BadRequestException(
          `La promo «${promo.title}» ya está en esta cartilla`,
        );
      }
      seenPromo.add(promo.id);
      const n = Number(item.pointsRequired);
      if (!Number.isInteger(n) || n < 1 || n > maxStamps) {
        throw new BadRequestException(
          `Elige una onda entre 1 y ${maxStamps} para «${promo.title}»`,
        );
      }
      const pool = promo.pool || "RETENCION";
      const key = `${n}:${pool}`;
      if (used.has(key)) {
        throw new BadRequestException(
          `Ya hay una promo de ${pool === "BIENVENIDA" ? "Adquisición" : "Retención"} en la onda ${n}`,
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
