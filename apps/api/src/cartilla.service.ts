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

function parseOptionalDay(raw?: string | null): Date | null {
  if (!raw) return null;
  return parseCartillaDay(raw);
}

const CARTILLA_INCLUDE = {
  passDesign: true,
  event: true,
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

/**
 * Máximo de cartillas ocasionales vivas a la vez por plan.
 * La cartilla base no cuenta para el límite.
 */
export const LIVE_CARTILLA_LIMITS: Record<string, number> = {
  BASIC: 2,
  PRO: 4,
};

export function liveCartillaLimitForPlan(planType: string): number {
  return LIVE_CARTILLA_LIMITS[planType] ?? 2;
}

@Injectable()
export class CartillaService {
  private readonly logger = new Logger(CartillaService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
  ) {}

  /**
   * Número de cartillas ocasionales vivas del negocio. Lanza 400 si activar
   * otra superaría el límite del plan (la base no cuenta).
   */
  private async assertWithinLiveLimit(storeId: string, excludeId?: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const limit = liveCartillaLimitForPlan(store.planType);
    const live = await this.resolveLiveCartillas(storeId);
    const count = live.filter(
      (c) => !c.isDefault && c.id !== excludeId,
    ).length;
    if (count >= limit) {
      const plan = store.planType === "PRO" ? "Pro" : "Basic";
      throw new BadRequestException(
        `Tu plan ${plan} permite hasta ${limit} cartillas activas a la vez. Finaliza una cartilla vigente o sube de plan.`,
      );
    }
  }

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

  /**
   * Una cartilla está "viva" (elegible por los clientes) si es la base, o si
   * es ocasional sin ventana y ACTIVE, o si su ventana no ha vencido (incluye
   * ventanas futuras: se pueden elegir antes de empezar).
   */
  isCartillaLive(
    cartilla: {
      isDefault: boolean;
      status: string;
      startsAt: Date | null;
      endsAt: Date | null;
    },
    now: Date = new Date(),
  ): boolean {
    if (cartilla.isDefault) return true;
    const hasWindow = Boolean(cartilla.startsAt && cartilla.endsAt);
    if (hasWindow) return cartillaCoversToday(null, cartilla.endsAt, now);
    return cartilla.status === "ACTIVE";
  }

  /**
   * Todas las cartillas vivas del negocio (base + ocasionales vigentes).
   * Sin efectos secundarios: no activa ni termina nada.
   */
  async resolveLiveCartillas(storeId: string): Promise<CartillaWithItems[]> {
    const def = await this.ensureDefaultCartilla(storeId);
    const now = new Date();
    const occasionals = await this.prisma.cartilla.findMany({
      where: { storeId, isDefault: false, status: { not: "ENDED" } },
      include: CARTILLA_INCLUDE,
      orderBy: { startsAt: "desc" },
    });
    const live = occasionals.filter((c) => this.isCartillaLive(c, now));
    return [def, ...live];
  }

  /**
   * Resolver la cartilla "primaria" del negocio: la primera ocasional viva, o
   * la base si no hay. Hace housekeeping de occasionales expiradas (las marca
   * ENDED sin tocar pases — la migración de pases la hace syncPassCartilla de
   * forma perezosa). Ya no mata cartillas vivas ni resetea puntos.
   */
  async resolveActiveCartilla(storeId: string): Promise<CartillaWithItems> {
    const def = await this.ensureDefaultCartilla(storeId);
    const now = new Date();
    const occasionals = await this.prisma.cartilla.findMany({
      where: { storeId, isDefault: false, status: { not: "ENDED" } },
      include: CARTILLA_INCLUDE,
      orderBy: { startsAt: "desc" },
    });

    let firstLive: CartillaWithItems | null = null;
    for (const cartilla of occasionals) {
      const hasWindow = Boolean(cartilla.startsAt && cartilla.endsAt);
      if (hasWindow) {
        const stillOpen = cartillaCoversToday(null, cartilla.endsAt, now);
        if (!stillOpen) {
          await this.prisma.cartilla.update({
            where: { id: cartilla.id },
            data: { status: "ENDED" },
          });
          continue;
        }
        if (!cartillaCoversToday(cartilla.startsAt, cartilla.endsAt, now)) {
          continue;
        }
      } else if (cartilla.status !== "ACTIVE") {
        continue;
      }
      if (!firstLive) firstLive = cartilla;
    }
    return firstLive ?? def;
  }

  /**
   * Mantiene el pase en una cartilla viva SIN pisar la elección del usuario:
   * si la cartilla del pase sigue viva, no toca nada. Si expiró (o es nula),
   * migra el pase a la base con reset de puntos.
   */
  async syncPassCartilla(passId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
      include: { store: true },
    });
    if (!pass.storeId) {
      return { switched: false, active: null as CartillaWithItems | null };
    }
    const now = new Date();
    const current = pass.cartillaId
      ? await this.prisma.cartilla.findUnique({
          where: { id: pass.cartillaId },
        })
      : null;
    if (current && this.isCartillaLive(current, now)) {
      const active = await this.prisma.cartilla.findUniqueOrThrow({
        where: { id: current.id },
        include: CARTILLA_INCLUDE,
      });
      return { switched: false, active };
    }

    const def = await this.ensureDefaultCartilla(pass.storeId);
    await this.prisma.pass.update({
      where: { id: passId },
      data: {
        cartillaId: def.id,
        points: 0,
        cycleStartedAt: new Date(),
      },
    });
    await this.assignPassPromos(passId);
    if (pass.walletRef) {
      const until = def.endsAt
        ? ` Tienes hasta el ${formatCartillaDay(def.endsAt)} para acumular y redimir.`
        : " El ciclo de ondas empieza de nuevo.";
      await this.wallet.updatePoints(
        pass.walletRef,
        0,
        `Tu cartilla de Onda se actualizó.${until}`,
      );
    }
    return { switched: true, active: def };
  }

  /**
   * Cambia la cartilla que el cliente carga en su pase. Reglas:
   * - La cartilla debe pertenecer al mismo negocio y estar viva (base o
   *   ocasional vigente/futura).
   * - Si el negocio tiene `shareCartillaProgress`, los puntos se transfieren
   *   (con tope de maxStamps de la nueva cartilla) y el ciclo se conserva.
   * - Si no, los puntos reinician de cero.
   */
  async switchPassCartilla(passId: string, cartillaId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (!pass.storeId) {
      throw new BadRequestException("Este pase no pertenece a un negocio");
    }
    const target = await this.prisma.cartilla.findUnique({
      where: { id: cartillaId },
    });
    if (!target || target.storeId !== pass.storeId) {
      throw new BadRequestException("La cartilla no pertenece a este negocio");
    }
    if (!this.isCartillaLive(target)) {
      throw new BadRequestException("Esta cartilla ya no está disponible");
    }
    if (pass.cartillaId === target.id) {
      return pass;
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: pass.storeId },
    });
    const share = Boolean(store.shareCartillaProgress);
    const points = share ? Math.min(pass.points, target.maxStamps) : 0;

    const updated = await this.prisma.pass.update({
      where: { id: passId },
      data: {
        cartillaId: target.id,
        points,
        cycleStartedAt: share ? pass.cycleStartedAt : new Date(),
      },
    });
    await this.assignPassPromos(passId);

    if (pass.walletRef) {
      const message = share
        ? `Tu progreso pasó a «${target.name}»: llevas ${points} onda${points === 1 ? "" : "s"}.`
        : `Ahora cargas «${target.name}». Tu progreso reinicia de cero.`;
      await this.wallet.updatePoints(pass.walletRef, points, message);
    }
    return updated;
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
      activeIds: (await this.resolveLiveCartillas(storeId)).map((c) => c.id),
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
          { startsAt: null, endsAt: null },
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
    eventId?: string | null;
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

    let event = null;
    if (body.eventId) {
      if (body.isDefault) {
        throw new BadRequestException(
          "La cartilla base no puede vincularse a un evento",
        );
      }
      event = await this.prisma.event.findUnique({
        where: { id: body.eventId },
      });
      if (!event) throw new BadRequestException("El evento no existe");
      if (event.ownerStoreId !== body.storeId) {
        throw new BadRequestException(
          "Solo puedes vincular cartillas a tus propios eventos",
        );
      }
    }

    const startsAt = parseOptionalDay(body.startsAt) ?? event?.startDate ?? null;
    const endsAt = parseOptionalDay(body.endsAt) ?? event?.endDate ?? null;
    if (!body.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        "La fecha de fin debe ser posterior al inicio",
      );
    }
    if (
      !body.isDefault &&
      this.isCartillaLive({ isDefault: false, status: "DRAFT", startsAt, endsAt })
    ) {
      await this.assertWithinLiveLimit(body.storeId);
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
        eventId: event?.id ?? null,
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
    return this.get(cartilla.id);
  }

  async update(
    id: string,
    body: {
      name?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      maxStamps?: number;
      eventId?: string | null;
      items?: Array<{ promotionId: string; pointsRequired: number }>;
    },
  ) {
    const cartilla = await this.get(id);
    let startsAt =
      body.startsAt !== undefined
        ? parseOptionalDay(body.startsAt)
        : cartilla.startsAt;
    let endsAt =
      body.endsAt !== undefined
        ? parseOptionalDay(body.endsAt)
        : cartilla.endsAt;

    let eventLink: string | null | undefined = undefined;
    let inheritEventDates = false;
    if (body.eventId !== undefined) {
      if (cartilla.isDefault && body.eventId) {
        throw new BadRequestException(
          "La cartilla base no puede vincularse a un evento",
        );
      }
      if (body.eventId) {
        const event = await this.prisma.event.findUnique({
          where: { id: body.eventId },
        });
        if (!event) throw new BadRequestException("El evento no existe");
        if (event.ownerStoreId !== cartilla.storeId) {
          throw new BadRequestException(
            "Solo puedes vincular cartillas a tus propios eventos",
          );
        }
        eventLink = event.id;
        // Hereda la ventana del evento si la cartilla no tiene fechas propias.
        if (!startsAt && !endsAt) {
          startsAt = event.startDate;
          endsAt = event.endDate;
          inheritEventDates = true;
        }
      } else {
        eventLink = null;
      }
    }

    if (!cartilla.isDefault && startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        "La fecha de fin debe ser posterior al inicio",
      );
    }
    if (cartilla.isDefault && (body.startsAt || body.endsAt)) {
      throw new BadRequestException("La cartilla base no usa fechas");
    }
    if (
      !cartilla.isDefault &&
      this.isCartillaLive({
        isDefault: false,
        status: cartilla.status,
        startsAt,
        endsAt,
      })
    ) {
      await this.assertWithinLiveLimit(cartilla.storeId, id);
    }

    const maxStamps =
      body.maxStamps != null ? assertCycle(body.maxStamps) : cartilla.maxStamps;

    await this.prisma.cartilla.update({
      where: { id },
      data: {
        ...("name" in body && body.name ? { name: body.name.trim() } : {}),
        ...(body.startsAt !== undefined ? { startsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt, smsRemindedAt: null } : {}),
        ...(inheritEventDates ? { startsAt, endsAt } : {}),
        ...(eventLink !== undefined ? { eventId: eventLink } : {}),
        ...(body.maxStamps != null ? { maxStamps } : {}),
      },
    });
    if (body.items) {
      await this.replacePromos(id, body.items, maxStamps);
    } else if (body.maxStamps != null) {
      await this.dropSlotsOverCycle(id, maxStamps);
    }

    const itemsChanged = Boolean(body.items);
    const cycleChanged =
      body.maxStamps != null && body.maxStamps !== cartilla.maxStamps;
    const datesChanged =
      body.startsAt !== undefined ||
      body.endsAt !== undefined ||
      inheritEventDates;
    const liveIds = (await this.resolveLiveCartillas(cartilla.storeId)).map(
      (c) => c.id,
    );
    if ((itemsChanged || cycleChanged) && liveIds.includes(id)) {
      await this.resyncLiveAssignments(id);
    }
    if (liveIds.includes(id) && (itemsChanged || cycleChanged || datesChanged)) {
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
    if (!this.isCartillaLive(cartilla)) return;

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
        "La cartilla base siempre está disponible para tus clientes",
      );
    }
    if (cartilla.status === "ACTIVE") {
      return cartilla;
    }
    await this.assertWithinLiveLimit(cartilla.storeId, id);
    const startsAt =
      cartilla.startsAt && cartillaCoversToday(cartilla.startsAt, null)
        ? cartilla.startsAt
        : !cartilla.endsAt
          ? null
          : parseCartillaDay(todayBogotaKey());
    await this.prisma.cartilla.update({
      where: { id },
      data: {
        status: "ACTIVE",
        startsAt,
      },
    });
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
      await this.migratePassesFromCartilla(cartilla.storeId, id);
    }
    return this.get(id);
  }

  /**
   * Migra a la cartilla base (con reset de puntos) solo los pases que cargaban
   * la cartilla terminada/expirada. Los pases en otras cartillas no se tocan.
   */
  async migratePassesFromCartilla(storeId: string, fromCartillaId: string) {
    const def = await this.ensureDefaultCartilla(storeId);
    const message = def.endsAt
      ? `Tu cartilla de Onda se actualizó. Tienes hasta el ${formatCartillaDay(def.endsAt)} para acumular y redimir.`
      : "Tu cartilla de Onda se actualizó. El ciclo de ondas empieza de nuevo.";
    const passes = await this.prisma.pass.findMany({
      where: { storeId, cartillaId: fromCartillaId },
    });
    for (const pass of passes) {
      await this.prisma.pass.update({
        where: { id: pass.id },
        data: {
          cartillaId: def.id,
          points: 0,
          cycleStartedAt: new Date(),
        },
      });
      await this.assignPassPromos(pass.id);
      if (pass.walletRef) {
        await this.wallet.updatePoints(pass.walletRef, 0, message);
      }
    }
    return def;
  }

  async assignPassPromos(passId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (!pass.storeId) return [];

    // El pase manda: se asignan promos de la cartilla que el usuario cargó.
    let cartilla = pass.cartillaId
      ? await this.prisma.cartilla.findUnique({
          where: { id: pass.cartillaId },
          include: CARTILLA_INCLUDE,
        })
      : null;
    if (!cartilla || !this.isCartillaLive(cartilla)) {
      cartilla = await this.ensureDefaultCartilla(pass.storeId);
      await this.prisma.pass.update({
        where: { id: passId },
        data: { cartillaId: cartilla.id },
      });
    }
    const active = cartilla;

    // Cartilla / redeem solo usa Retención. Adquisición (BIENVENIDA) es para campañas.
    const items = active.items.filter(
      (i) => i.pool === "RETENCION" && i.pointsRequired <= active.maxStamps,
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
    // El canje se valida contra la cartilla que el pase carga: si ya no es
    // elegible, syncPassCartilla lo migra a la base y el assignment lookup
    // de abajo falla con "no está en tu cartilla".
    if (pass.cartillaId) {
      const current = await this.prisma.cartilla.findUnique({
        where: { id: pass.cartillaId },
      });
      if (!current || !this.isCartillaLive(current)) {
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
