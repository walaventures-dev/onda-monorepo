import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';

const STORE_SLUG = 'onda-spa';
/** Arranca cerca del final para que la demo muestre slots vacíos y cierre rápido. */
const DEMO_START_POINTS = 8;
const REDEEM_MESSAGE = '¡Listo! 30% en tu próxima sesión de masajes.';

function devicePhone(deviceId: string) {
  const hex = createHash('sha256').update(`onda-spa:${deviceId}`).digest('hex').slice(0, 10);
  return `+5799${hex}`;
}

function deviceSerial(deviceId: string) {
  const hex = createHash('sha256')
    .update(`onda-spa-serial:${deviceId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `ONDA-SPA-${hex}`;
}

@Controller('demo/onda-spa')
export class DemoOndaSpaController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
  ) {}

  private async getStore() {
    const store = await this.prisma.store.findUnique({
      where: { slug: STORE_SLUG },
      include: {
        passDesign: true,
        promotions: { where: { isActive: true }, orderBy: { pointsRequired: 'asc' } },
      },
    });
    if (!store) {
      throw new NotFoundException('Onda Spa demo no está sembrado. Corre pnpm db:seed.');
    }
    return store;
  }

  private async passState(passId: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
      include: {
        user: true,
        store: { include: { passDesign: true, promotions: { where: { isActive: true } } } },
      },
    });
    const redeemedThisCycle = await this.prisma.transaction.findFirst({
      where: {
        passId: pass.id,
        type: 'REDEEM',
        createdAt: { gte: pass.cycleStartedAt },
      },
    });
    const design = pass.store?.passDesign;
    const maxStamps = pass.store?.maxStamps ?? 10;
    const promo =
      pass.store?.promotions.find((p) => p.pointsRequired === maxStamps) ||
      pass.store?.promotions[0] ||
      null;

    return {
      passId: pass.id,
      points: pass.points,
      maxStamps,
      walletRef: pass.walletRef,
      memberName: pass.user.name,
      redeemedThisCycle: Boolean(redeemedThisCycle),
      design: design
        ? {
            title: design.title,
            subtitle: design.subtitle,
            description: design.description,
            backgroundColor: design.backgroundColor,
            foregroundColor: design.foregroundColor,
            labelColor: design.labelColor,
            logoUrl: design.logoUrl,
          }
        : null,
      promo: promo
        ? {
            id: promo.id,
            title: promo.title,
            description: promo.description,
            pointsRequired: promo.pointsRequired,
            value: promo.value,
          }
        : null,
    };
  }

  @Get()
  async info() {
    const store = await this.getStore();
    const promo =
      store.promotions.find((p) => p.pointsRequired === store.maxStamps) || store.promotions[0];
    return {
      storeId: store.id,
      slug: store.slug,
      name: store.name,
      maxStamps: store.maxStamps,
      design: store.passDesign,
      promo,
    };
  }

  @Get('state/:deviceId')
  async state(@Param('deviceId') deviceId: string) {
    if (!deviceId || deviceId.length < 8) {
      throw new BadRequestException('deviceId inválido');
    }
    const store = await this.getStore();
    const phone = devicePhone(deviceId);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return { active: false as const };
    }
    const pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, storeId: store.id },
    });
    if (!pass) {
      return { active: false as const };
    }
    const state = await this.passState(pass.id);
    return {
      active: true as const,
      ...state,
      needsWelcomePulse: state.points === DEMO_START_POINTS && !state.redeemedThisCycle,
    };
  }

  @Post('activate')
  async activate(@Body() body: { deviceId?: string }) {
    const deviceId = body?.deviceId?.trim();
    if (!deviceId || deviceId.length < 8) {
      throw new BadRequestException('deviceId inválido');
    }

    const store = await this.getStore();
    const phone = devicePhone(deviceId);
    const serial = deviceSerial(deviceId);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { name: 'Visitante Onda', phone },
      });
    }

    let pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, storeId: store.id },
    });

    const isNew = !pass;
    if (!pass) {
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId: store.id,
          serialNumber: serial,
          points: DEMO_START_POINTS,
        },
      });
    }

    const design = store.passDesign || {
      title: store.name,
      subtitle: 'Masajes y bienestar',
      description: '',
      backgroundColor: '#C9DDD4',
      foregroundColor: '#2F4F46',
      labelColor: '#5F7F74',
      logoUrl: null as string | null,
      stripImageUrl: null as string | null,
    };

    let appleUrl: string | null = null;
    let googleUrl: string | null = null;
    let stub = false;

    try {
      const issued = await this.wallet.issuePass({
        serialNumber: pass.serialNumber,
        points: pass.points,
        holderName: user.name,
        organizationName: store.name,
        maxStamps: store.maxStamps,
        kind: 'store',
        design: {
          title: design.title,
          subtitle: design.subtitle,
          description: design.description || '',
          backgroundColor: design.backgroundColor,
          foregroundColor: design.foregroundColor,
          labelColor: design.labelColor,
          logoUrl: design.logoUrl,
          stripImageUrl: design.stripImageUrl ?? null,
        },
      });
      appleUrl = issued.appleUrl;
      googleUrl = issued.googleUrl;
      stub = issued.walletRef.startsWith('stub-');
      await this.prisma.pass.update({
        where: { id: pass.id },
        data: { walletRef: issued.walletRef },
      });
    } catch (err) {
      console.error('Demo Onda Spa issue failed', err);
    }

    const state = await this.passState(pass.id);
    return {
      ...state,
      isNew,
      phase: 'activated' as const,
      appleUrl,
      googleUrl,
      stub,
      needsWelcomePulse: state.points === DEMO_START_POINTS && !state.redeemedThisCycle,
    };
  }

  @Post('pulse')
  async pulse(@Body() body: { deviceId?: string }) {
    const deviceId = body?.deviceId?.trim();
    if (!deviceId || deviceId.length < 8) {
      throw new BadRequestException('deviceId inválido');
    }

    const store = await this.getStore();
    const phone = devicePhone(deviceId);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new BadRequestException('Activa la tarjeta primero');
    }

    const pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, storeId: store.id },
    });
    if (!pass) {
      throw new BadRequestException('Activa la tarjeta primero');
    }

    const promo =
      store.promotions.find((p) => p.pointsRequired === store.maxStamps) || store.promotions[0];
    if (!promo) {
      throw new BadRequestException('Promo demo no configurada');
    }

    const redeemedThisCycle = await this.prisma.transaction.findFirst({
      where: {
        passId: pass.id,
        type: 'REDEEM',
        createdAt: { gte: pass.cycleStartedAt },
      },
    });

    if (redeemedThisCycle) {
      const state = await this.passState(pass.id);
      return { ...state, action: 'already_redeemed' as const };
    }

    if (pass.points < store.maxStamps) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.pass.update({
          where: { id: pass.id },
          data: { points: { increment: 1 } },
        });
        await tx.transaction.create({
          data: {
            passId: pass.id,
            storeId: store.id,
            type: 'ACCUMULATE',
            points: 1,
          },
        });
        return next;
      });

      if (updated.walletRef) {
        try {
          await this.wallet.updatePoints(updated.walletRef, updated.points);
        } catch (err) {
          console.error('Demo pulse wallet update failed', err);
        }
      }

      const state = await this.passState(pass.id);
      return { ...state, action: 'accumulated' as const };
    }

    const isFinalReward = promo.pointsRequired === store.maxStamps;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.pass.findUniqueOrThrow({ where: { id: pass.id } });
      if (current.points < promo.pointsRequired) {
        throw new BadRequestException('Aún no alcanzas este premio');
      }
      await tx.transaction.create({
        data: {
          passId: pass.id,
          storeId: store.id,
          type: 'REDEEM',
          points: promo.pointsRequired,
          promotionId: promo.id,
        },
      });
      // Demo: baja a 0 sin rotar cycleStartedAt para que redeemedThisCycle siga siendo true.
      await tx.pass.update({
        where: { id: pass.id },
        data: isFinalReward ? { points: 0 } : {},
      });
    });

    const updatedPass = await this.prisma.pass.findUniqueOrThrow({ where: { id: pass.id } });
    if (updatedPass.walletRef) {
      try {
        await this.wallet.updatePoints(updatedPass.walletRef, updatedPass.points);
        await this.wallet.notify(updatedPass.walletRef, REDEEM_MESSAGE);
      } catch (err) {
        console.error('Demo redeem wallet update failed', err);
      }
    }

    const state = await this.passState(pass.id);
    return {
      ...state,
      action: 'redeemed' as const,
      notification: REDEEM_MESSAGE,
    };
  }
}
