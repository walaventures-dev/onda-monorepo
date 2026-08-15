import {
  Inject,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  PromotionType,
  PromotionExpiryMode,
  PromotionPool,
  PromotionIntent,
} from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { CartillaService, assignmentCap } from "./cartilla.service";

function parseDateStart(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function previousPeriod(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms);
  return { prevFrom, prevTo };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function promoDisplayTitle(p: {
  type?: string | null;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  title?: string | null;
}) {
  switch (p.type) {
    case "PRODUCT": {
      const name = (p.productName || "").trim();
      return name ? `${name} Gratis` : "Producto Gratis";
    }
    case "PERCENT_OFF":
      return `${p.value ?? 0}% de descuento`;
    case "AMOUNT_OFF":
      return `$${Number(p.value || 0).toLocaleString("es-CO")} de descuento`;
    case "BUY_GET":
      return `${p.buyQuantity || 1}x${p.getQuantity || 1}`;
    default:
      return (p.title || "").trim() || "Promo";
  }
}

function promoConditions(p: {
  type: string;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  maxRedemptions?: number | null;
  pool?: string | null;
}) {
  return JSON.stringify({
    type: p.type,
    value: p.value ?? null,
    buyQuantity: p.buyQuantity ?? null,
    getQuantity: p.getQuantity ?? null,
    productName: p.productName || null,
    maxRedemptions: p.maxRedemptions ?? null,
    pool: p.pool || "RETENCION",
  });
}

function assertPromoConfig(body: {
  type?: PromotionType;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  title?: string;
}) {
  const type = body.type || "OTHER";
  if (type === "PRODUCT") {
    if (!String(body.productName || "").trim()) {
      throw new BadRequestException("Indica el nombre del producto");
    }
    if (body.value == null || Number(body.value) <= 0) {
      throw new BadRequestException(
        "Indica el precio del producto para poder hacer seguimiento",
      );
    }
  }
  if (type === "PERCENT_OFF") {
    const n = Number(body.value);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      throw new BadRequestException("El porcentaje debe estar entre 1 y 100");
    }
  }
  if (type === "AMOUNT_OFF") {
    if (body.value == null || Number(body.value) <= 0) {
      throw new BadRequestException("Indica el valor del descuento");
    }
  }
  if (type === "BUY_GET") {
    if (!body.buyQuantity || !body.getQuantity) {
      throw new BadRequestException("Indica cuántos compra y cuántos lleva");
    }
  }
}

function intentForPoints(points: number, maxStamps: number): PromotionIntent {
  if (points >= maxStamps) return "PREMIO";
  if (points <= Math.max(1, Math.floor(maxStamps / 3))) return "GANCHO";
  return "INTERMEDIA";
}

@Controller("promotions")
export class PromotionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(CartillaService) private cartillas: CartillaService,
  ) {}

  @Get()
  async list(
    @Query("storeId") storeId?: string,
    @Query("eventId") eventId?: string,
    @Query("type") type?: string,
    @Query("isActive") isActive?: string,
    @Query("pool") pool?: string,
  ) {
    const types = type
      ? (type.split(",").filter(Boolean) as PromotionType[])
      : undefined;
    const rows = await this.prisma.promotion.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(eventId ? { eventId } : {}),
        ...(types?.length ? { type: { in: types } } : {}),
        ...(isActive === "true" ? { isActive: true } : {}),
        ...(isActive === "false" ? { isActive: false } : {}),
        ...(pool === "BIENVENIDA" || pool === "RETENCION" ? { pool } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    const ids = rows.map((r) => r.id);
    const [redeemGroups, assignGroups] = await Promise.all([
      ids.length
        ? this.prisma.transaction.groupBy({
            by: ["promotionId"],
            where: { promotionId: { in: ids }, type: "REDEEM" },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? this.prisma.passPromoAssignment.groupBy({
            by: ["promotionId"],
            where: { promotionId: { in: ids } },
            _count: { _all: true },
          })
        : [],
    ]);
    const redeemMap = new Map(
      redeemGroups.map((g) => [g.promotionId, g._count._all]),
    );
    const assignMap = new Map(
      assignGroups.map((g) => [g.promotionId, g._count._all]),
    );
    const canMove = await Promise.all(
      ids.map((id) => this.cartillas.canMovePool(id)),
    );
    return rows.map((p, i) => {
      const redemptionCount = redeemMap.get(p.id) || 0;
      const assignmentCount = assignMap.get(p.id) || 0;
      const cap = assignmentCap(p.maxRedemptions);
      const remaining =
        p.maxRedemptions != null
          ? Math.max(0, p.maxRedemptions - redemptionCount)
          : null;
      const needsReplacement =
        remaining === 0 || (cap != null && assignmentCount >= cap);
      return {
        ...p,
        redemptionCount,
        assignmentCount,
        assignmentCap: cap,
        remaining,
        needsReplacement,
        canMovePool: canMove[i],
        locked: redemptionCount > 0,
      };
    });
  }

  @Get(":id/analytics")
  async analytics(
    @Param("id") id: string,
    @Query("from") fromQ?: string,
    @Query("to") toQ?: string,
    @Query("cartillaId") cartillaId?: string,
  ) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException("Promoción no encontrada");

    const to =
      parseDateEnd(toQ) ||
      (() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
      })();
    const from =
      parseDateStart(fromQ) ||
      (() => {
        const d = new Date(to);
        d.setDate(d.getDate() - 13);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
    const { prevFrom, prevTo } = previousPeriod(from, to);

    const redeemWhere = {
      promotionId: id,
      type: "REDEEM" as const,
      ...(cartillaId ? { cartillaId } : {}),
    };

    const [txs, prevCount, allTimeCount, allTimeGlobal, storePasses, links] =
      await Promise.all([
        this.prisma.transaction.findMany({
          where: {
            ...redeemWhere,
            createdAt: { gte: from, lte: to },
          },
          include: {
            pass: { include: { user: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.transaction.count({
          where: {
            ...redeemWhere,
            createdAt: { gte: prevFrom, lte: prevTo },
          },
        }),
        this.prisma.transaction.count({ where: redeemWhere }),
        this.prisma.transaction.count({
          where: { promotionId: id, type: "REDEEM" },
        }),
        promo.storeId
          ? this.prisma.pass.findMany({
              where: { storeId: promo.storeId },
              select: {
                id: true,
                points: true,
                userId: true,
                cartillaId: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.cartillaPromo.findMany({
          where: { promotionId: id },
          include: { cartilla: true },
        }),
      ]);

    const seriesMap = new Map<
      string,
      { date: string; canjes: number; ondasCost: number }
    >();
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const key = dayKey(new Date(t));
      seriesMap.set(key, { date: key, canjes: 0, ondasCost: 0 });
    }
    for (const tx of txs) {
      const key = dayKey(tx.createdAt);
      const row = seriesMap.get(key) || { date: key, canjes: 0, ondasCost: 0 };
      row.canjes += 1;
      row.ondasCost += tx.points;
      seriesMap.set(key, row);
    }
    const series = [...seriesMap.values()];

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        phone: string;
        redemptions: number;
        lastRedeemAt: Date;
        passId: string;
        currentPoints: number;
      }
    >();
    for (const tx of txs) {
      const u = tx.pass.user;
      const existing = byUser.get(u.id);
      if (existing) {
        existing.redemptions += 1;
        if (tx.createdAt > existing.lastRedeemAt) {
          existing.lastRedeemAt = tx.createdAt;
        }
      } else {
        byUser.set(u.id, {
          userId: u.id,
          name: u.name,
          phone: u.phone,
          redemptions: 1,
          lastRedeemAt: tx.createdAt,
          passId: tx.passId,
          currentPoints: tx.pass.points,
        });
      }
    }
    const redeemers = [...byUser.values()].sort(
      (a, b) =>
        b.redemptions - a.redemptions ||
        b.lastRedeemAt.getTime() - a.lastRedeemAt.getTime(),
    );

    const remaining =
      promo.maxRedemptions != null
        ? Math.max(0, promo.maxRedemptions - allTimeGlobal)
        : null;

    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      canjes: 0,
    }));
    for (const tx of txs) {
      hourly[tx.createdAt.getHours()].canjes += 1;
    }

    const assignmentCount = await this.prisma.passPromoAssignment.count({
      where: {
        promotionId: id,
        ...(cartillaId ? { cartillaId } : {}),
      },
    });
    const cap = assignmentCap(promo.maxRedemptions);

    const assignmentRows = await this.prisma.passPromoAssignment.findMany({
      where: {
        promotionId: id,
        ...(cartillaId ? { cartillaId } : {}),
      },
      select: { passId: true, pointsRequired: true },
    });
    const needByPass = new Map(
      assignmentRows.map((a) => [a.passId, a.pointsRequired]),
    );
    const elegibles = storePasses.filter((p) => {
      const need = needByPass.get(p.id);
      return need != null && p.points >= need;
    }).length;

    const byCartilla = await Promise.all(
      links.map(async (link) => {
        const canjesC = await this.prisma.transaction.count({
          where: {
            promotionId: id,
            type: "REDEEM",
            cartillaId: link.cartillaId,
          },
        });
        const assignmentsC = await this.prisma.passPromoAssignment.count({
          where: { promotionId: id, cartillaId: link.cartillaId },
        });
        return {
          cartillaId: link.cartillaId,
          name: link.cartilla.name,
          status: link.cartilla.status,
          isDefault: link.cartilla.isDefault,
          canjes: canjesC,
          assignmentCount: assignmentsC,
          assignmentCap: cap,
          remaining:
            promo.maxRedemptions != null
              ? Math.max(0, promo.maxRedemptions - allTimeGlobal)
              : null,
        };
      }),
    );

    const uniqueRedeemers = redeemers.length;
    const ondasCost = txs.reduce((s, t) => s + t.points, 0);
    const canjes = txs.length;
    const repeatRedeemers = redeemers.filter((r) => r.redemptions > 1).length;

    return {
      promotion: promo,
      locked: allTimeGlobal > 0,
      redemptionCount: allTimeGlobal,
      remaining,
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
      },
      kpis: {
        canjes,
        canjesDelta: pctDelta(canjes, prevCount),
        canjesAllTime: allTimeCount,
        canjesGlobal: allTimeGlobal,
        clientesUnicos: uniqueRedeemers,
        clientesRepetidores: repeatRedeemers,
        ondasGastadas: ondasCost,
        elegibles,
        conversionElegibles:
          elegibles > 0 ? Math.round((uniqueRedeemers / elegibles) * 100) : 0,
        costeMedioOndas:
          canjes > 0 ? Math.round(ondasCost / canjes) : promo.pointsRequired,
        remaining,
        maxRedemptions: promo.maxRedemptions,
        assignmentCount,
        assignmentCap: cap,
      },
      byCartilla,
      series,
      hourly,
      redeemers,
      history: txs.map((tx) => ({
        id: tx.id,
        points: tx.points,
        createdAt: tx.createdAt,
        passId: tx.passId,
        cartillaId: tx.cartillaId,
        user: {
          id: tx.pass.user.id,
          name: tx.pass.user.name,
          phone: tx.pass.user.phone,
        },
      })),
    };
  }

  @Get(":id")
  async one(@Param("id") id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException("Promoción no encontrada");
    const redemptionCount = await this.prisma.transaction.count({
      where: { promotionId: id, type: "REDEEM" },
    });
    const assignmentCount = await this.prisma.passPromoAssignment.count({
      where: { promotionId: id },
    });
    const cap = assignmentCap(promo.maxRedemptions);
    const remaining =
      promo.maxRedemptions != null
        ? Math.max(0, promo.maxRedemptions - redemptionCount)
        : null;
    return {
      ...promo,
      redemptionCount,
      assignmentCount,
      assignmentCap: cap,
      remaining,
      needsReplacement:
        remaining === 0 || (cap != null && assignmentCount >= cap),
      canMovePool: await this.cartillas.canMovePool(id),
      locked: redemptionCount > 0,
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      title?: string;
      pointsRequired?: number;
      storeId?: string;
      eventId?: string;
      description?: string;
      imageUrl?: string;
      isActive?: boolean;
      type?: PromotionType;
      value?: number;
      buyQuantity?: number;
      getQuantity?: number;
      productName?: string;
      pool?: PromotionPool;
      intent?: PromotionIntent;
      duplicatedFromId?: string;
      expiryMode?: PromotionExpiryMode;
      endsAt?: string;
      maxRedemptions?: number;
    },
  ) {
    if (body.eventId && !body.storeId) {
      if (body.expiryMode === "TIME" && !body.endsAt) {
        throw new BadRequestException("Indica hasta cuándo estará disponible");
      }
    }
    const type = body.type || "OTHER";
    if (body.storeId) {
      assertPromoConfig(body);
      if (body.duplicatedFromId) {
        const source = await this.prisma.promotion.findUniqueOrThrow({
          where: { id: body.duplicatedFromId },
        });
        const next = {
          type,
          value: body.value ?? null,
          buyQuantity: body.buyQuantity ?? null,
          getQuantity: body.getQuantity ?? null,
          productName: body.productName || null,
          maxRedemptions: body.maxRedemptions ?? null,
          pool: body.pool || "RETENCION",
        };
        if (promoConditions(source) === promoConditions(next)) {
          throw new BadRequestException(
            "Para duplicar debes cambiar al menos una condición (beneficio, cupo o bolsa)",
          );
        }
      }
      await this.cartillas.ensureDefaultCartilla(body.storeId);
    }
    const pool = body.pool === "BIENVENIDA" ? "BIENVENIDA" : "RETENCION";
    const title = promoDisplayTitle({
      type,
      value: body.value,
      buyQuantity: body.buyQuantity,
      getQuantity: body.getQuantity,
      productName: body.productName,
      title: body.title,
    });
    const pointsRequired = body.eventId ? Number(body.pointsRequired) || 1 : 0;
    let intent = body.intent;
    if (!intent && body.storeId) {
      intent = "INTERMEDIA";
    } else if (!intent && body.eventId) {
      intent = intentForPoints(pointsRequired, 10);
    }
    return this.prisma.promotion.create({
      data: {
        title,
        pointsRequired,
        storeId: body.storeId,
        eventId: body.eventId,
        description: body.description,
        imageUrl: body.imageUrl,
        isActive: body.isActive ?? true,
        type,
        value: body.value != null ? Number(body.value) : undefined,
        buyQuantity:
          body.buyQuantity != null ? Number(body.buyQuantity) : undefined,
        getQuantity:
          body.getQuantity != null ? Number(body.getQuantity) : undefined,
        productName: body.productName,
        pool: body.storeId ? pool : "RETENCION",
        intent: intent || "INTERMEDIA",
        duplicatedFromId: body.duplicatedFromId,
        expiryMode: body.eventId ? body.expiryMode || "TIME" : "QUANTITY",
        endsAt:
          body.eventId && body.expiryMode === "TIME" && body.endsAt
            ? new Date(body.endsAt)
            : null,
        maxRedemptions:
          body.maxRedemptions != null ? Number(body.maxRedemptions) : null,
      },
    });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      title: string;
      pointsRequired: number;
      description: string;
      imageUrl: string | null;
      isActive: boolean;
      type: PromotionType;
      value: number | null;
      buyQuantity: number | null;
      getQuantity: number | null;
      productName: string | null;
      pool: PromotionPool;
      intent: PromotionIntent;
      maxRedemptions: number | null;
    }>,
  ) {
    const existing = await this.prisma.promotion.findUniqueOrThrow({
      where: { id },
    });
    if (body.pointsRequired != null && existing.eventId) {
      if (Number(body.pointsRequired) < 1) {
        throw new BadRequestException("Onda inválida");
      }
    }

    if (body.pool && body.pool !== existing.pool) {
      const can = await this.cartillas.canMovePool(id);
      if (!can) {
        throw new BadRequestException(
          "Ya hay clientes en una cartilla con esta promo. Duplica y cambia una condición.",
        );
      }
    }

    const redemptionCount = await this.prisma.transaction.count({
      where: { promotionId: id, type: "REDEEM" },
    });

    if (redemptionCount > 0) {
      const allowed: Record<string, unknown> = {};
      if ("imageUrl" in body) allowed.imageUrl = body.imageUrl;
      if ("isActive" in body) allowed.isActive = body.isActive;
      if (Object.keys(allowed).length === 0) {
        throw new BadRequestException(
          "Esta promo ya fue redimida: solo puedes cambiar la foto",
        );
      }
      return this.prisma.promotion.update({ where: { id }, data: allowed });
    }

    const type = body.type || existing.type;
    const merged = {
      type,
      value: "value" in body ? body.value : existing.value,
      buyQuantity:
        "buyQuantity" in body ? body.buyQuantity : existing.buyQuantity,
      getQuantity:
        "getQuantity" in body ? body.getQuantity : existing.getQuantity,
      productName:
        "productName" in body ? body.productName : existing.productName,
      title: "title" in body ? body.title : existing.title,
    };
    if (existing.storeId) assertPromoConfig(merged);

    return this.prisma.promotion.update({
      where: { id },
      data: {
        title: promoDisplayTitle(merged),
        ...("description" in body ? { description: body.description } : {}),
        ...("imageUrl" in body ? { imageUrl: body.imageUrl } : {}),
        ...("isActive" in body ? { isActive: body.isActive } : {}),
        ...("type" in body ? { type: body.type } : {}),
        ...("productName" in body ? { productName: body.productName } : {}),
        ...("pool" in body && body.pool ? { pool: body.pool } : {}),
        ...("intent" in body && body.intent ? { intent: body.intent } : {}),
        ...(existing.eventId && body.pointsRequired != null
          ? { pointsRequired: Number(body.pointsRequired) }
          : {}),
        value: body.value != null ? Number(body.value) : body.value,
        buyQuantity:
          body.buyQuantity != null
            ? Number(body.buyQuantity)
            : body.buyQuantity,
        getQuantity:
          body.getQuantity != null
            ? Number(body.getQuantity)
            : body.getQuantity,
        ...("maxRedemptions" in body
          ? {
              maxRedemptions:
                body.maxRedemptions != null
                  ? Number(body.maxRedemptions)
                  : null,
            }
          : {}),
      },
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }
}
