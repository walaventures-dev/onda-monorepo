import { Inject, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { CustomerAuthService } from './customer-auth.service';
import { CartillaService } from './cartilla.service';
import { resolvePassDesign, toPassDesignInput } from './pass-design.util';
import { storePassHydrateSelect } from './store-select';

function randomSerial() {
  return `ONDA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('passes')
export class PassesController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  private async withClaimedThisCycle<T extends { id: string; cycleStartedAt: Date }>(pass: T) {
    const claimedThisCycle = await this.prisma.transaction.findMany({
      where: {
        passId: pass.id,
        type: 'REDEEM',
        createdAt: { gte: pass.cycleStartedAt },
        promotionId: { not: null },
      },
      select: { promotionId: true },
    });
    return {
      ...pass,
      claimedPromotionIdsThisCycle: claimedThisCycle.map((t) => t.promotionId as string),
    };
  }

  private async hydratePass(id: string) {
    const raw = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
    });
    if (raw.storeId) {
      await this.cartillas.syncPassCartilla(id);
    }
    const passRow = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
    });
    const passCartillaId = passRow.cartillaId;
    if (raw.storeId) {
      const hasAssignments = await this.prisma.passPromoAssignment.count({
        where: { passId: id, cartillaId: passCartillaId || undefined },
      });
      if (!hasAssignments) {
        await this.cartillas.assignPassPromos(id);
      }
    }

    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        store: { select: { ...storePassHydrateSelect } },
        event: { include: { passDesign: true, promotions: true } },
        cartilla: { include: { passDesign: true } },
        promoAssignments: {
          where: passCartillaId ? { cartillaId: passCartillaId } : undefined,
          include: { promotion: true },
        },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    const assignedPromos = pass.promoAssignments
      .filter((a) => {
        const p = a.promotion;
        if (!p.isActive) return false;
        if (p.maxRedemptions == null) return true;
        return true;
      })
      .map((a) => ({
        ...a.promotion,
        pointsRequired: a.pointsRequired,
      }));

    const remainingByPromo = await Promise.all(
      assignedPromos.map(async (p) => {
        if (p.maxRedemptions == null) return { id: p.id, ok: true };
        const used = await this.prisma.transaction.count({
          where: { promotionId: p.id, type: 'REDEEM' },
        });
        return { id: p.id, ok: used < p.maxRedemptions };
      })
    );
    const ok = new Set(remainingByPromo.filter((r) => r.ok).map((r) => r.id));
    const promotions = assignedPromos.filter((p) => ok.has(p.id));

    const design = toPassDesignInput(
      pass.eventId
        ? resolvePassDesign(pass.event?.passDesign)
        : resolvePassDesign(
            pass.cartilla?.passDesign,
            pass.store?.passDesign
          )
    );

    const withClaimed = await this.withClaimedThisCycle(pass);
    const walletLinks = pass.walletRef ? this.wallet.linksFor(pass.walletRef) : null;
    const choosableCartillas = pass.storeId
      ? (await this.cartillas.resolveLiveCartillas(pass.storeId)).map((c) => ({
          id: c.id,
          name: c.name,
          isDefault: c.isDefault,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          maxStamps: c.maxStamps,
        }))
      : [];
    return {
      ...withClaimed,
      promotions,
      assignments: pass.promoAssignments,
      passDesign: design,
      walletActive: await this.wallet.isActive(pass.walletRef),
      appleUrl: walletLinks?.appleUrl ?? null,
      googleUrl: walletLinks?.googleUrl ?? null,
      maxStamps: pass.cartilla?.maxStamps ?? pass.store?.maxStamps ?? 12,
      choosableCartillas,
      cartilla: pass.cartilla
        ? {
            id: pass.cartilla.id,
            name: pass.cartilla.name,
            isDefault: pass.cartilla.isDefault,
            startsAt: pass.cartilla.startsAt,
            endsAt: pass.cartilla.endsAt,
            status: pass.cartilla.status,
            maxStamps: pass.cartilla.maxStamps,
            passDesign: pass.cartilla.passDesign,
          }
        : null,
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.hydratePass(id);
  }

  @Get()
  async byUser(@Query('userId') userId: string, @Query('storeId') storeId?: string) {
    const passes = await this.prisma.pass.findMany({
      where: { userId, ...(storeId ? { storeId } : {}) },
      select: { id: true },
    });
    return Promise.all(passes.map((p) => this.hydratePass(p.id)));
  }

  @Post(':id/issue')
  async issue(@Param('id') id: string) {
    const hydrated = await this.hydratePass(id);
    const design = hydrated.passDesign || {
      title: 'Onda',
      subtitle: 'Loyalty',
      description: '',
      backgroundColor: '#052DDE',
      foregroundColor: '#FFFFFF',
      labelColor: '#E5F6FC',
      logoUrl: null,
      stripImageUrl: null,
    };
    if (hydrated.walletRef) {
      await this.wallet.updatePoints(hydrated.walletRef, hydrated.points);
      return this.wallet.linksFor(hydrated.walletRef);
    }
    const issued = await this.wallet.issuePass({
      serialNumber: hydrated.serialNumber,
      points: hydrated.points,
      holderName: hydrated.user.name,
      organizationName:
        hydrated.store?.name ?? hydrated.event?.name ?? design.title,
      maxStamps: hydrated.cartilla?.maxStamps ?? hydrated.store?.maxStamps,
      validUntil: hydrated.cartilla?.endsAt ?? null,
      kind: hydrated.eventId ? 'event' : 'store',
      design,
    });

    await this.prisma.pass.update({
      where: { id },
      data: { walletRef: issued.walletRef },
    });

    return issued;
  }

  @Post(':id/cartilla')
  async switchCartilla(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Body() body: { cartillaId: string }
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const existing = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
    });
    if (existing.userId !== user.id) {
      throw new ForbiddenException('Este pase no es tuyo');
    }
    await this.cartillas.switchPassCartilla(id, body.cartillaId);
    return this.hydratePass(id);
  }

  @Post('store/:storeId/claim')
  async claimStorePass(
    @Param('storeId') storeId: string,
    @Headers('authorization') authHeader: string
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));

    let pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, storeId },
    });
    if (!pass) {
      const base = await this.cartillas.ensureDefaultCartilla(storeId);
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId,
          cartillaId: base.id,
          serialNumber: randomSerial(),
          points: 0,
        },
      });
      await this.cartillas.assignPassPromos(pass.id);
    }

    return this.hydratePass(pass.id);
  }
}
