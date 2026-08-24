import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
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

const DEMO_STORE = {
  slug: STORE_SLUG,
  name: 'Onda Spa',
  maxStamps: 10,
  design: {
    title: 'Onda Spa',
    subtitle: 'Masajes y bienestar',
    description: 'Completa 10 ondas y lleva 30% en tu próxima sesión de masajes',
    backgroundColor: '#C9DDD4',
    foregroundColor: '#2F4F46',
    labelColor: '#5F7F74',
    logoUrl: null as string | null,
    stripImageUrl: null as string | null,
  },
  promo: {
    id: 'demo-spa-promo',
    title: '30% de descuento',
    description: '30% de descuento en tu próxima sesión de masajes',
    pointsRequired: 10,
    value: 30,
  },
};

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

function redeemedThisCycle(points: number) {
  return points === 0;
}

@Controller('demo/onda-spa')
export class DemoOndaSpaController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
  ) {}

  private passState(pass: {
    id: string;
    points: number;
    walletRef: string | null;
    user: { name: string };
  }) {
    const { design, promo, maxStamps } = DEMO_STORE;

    return {
      passId: pass.id,
      points: pass.points,
      maxStamps,
      walletRef: pass.walletRef,
      memberName: pass.user.name,
      redeemedThisCycle: redeemedThisCycle(pass.points),
      design: {
        title: design.title,
        subtitle: design.subtitle,
        description: design.description,
        backgroundColor: design.backgroundColor,
        foregroundColor: design.foregroundColor,
        labelColor: design.labelColor,
        logoUrl: design.logoUrl,
      },
      promo: {
        id: promo.id,
        title: promo.title,
        description: promo.description,
        pointsRequired: promo.pointsRequired,
        value: promo.value,
      },
    };
  }

  @Get()
  info() {
    const { slug, name, maxStamps, design, promo } = DEMO_STORE;
    return {
      slug,
      name,
      maxStamps,
      design,
      promo,
    };
  }

  @Get('state/:deviceId')
  async state(@Param('deviceId') deviceId: string) {
    if (!deviceId || deviceId.length < 8) {
      throw new BadRequestException('deviceId inválido');
    }
    const phone = devicePhone(deviceId);
    const serial = deviceSerial(deviceId);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return { active: false as const };
    }
    const pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, serialNumber: serial },
      include: { user: true },
    });
    if (!pass) {
      return { active: false as const };
    }
    const state = this.passState(pass);
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

    const phone = devicePhone(deviceId);
    const serial = deviceSerial(deviceId);
    const { design, maxStamps, name } = DEMO_STORE;

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { name: 'Visitante Onda', phone },
      });
    }

    let pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, serialNumber: serial },
      include: { user: true },
    });

    const isNew = !pass;
    if (!pass) {
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          serialNumber: serial,
          points: DEMO_START_POINTS,
        },
        include: { user: true },
      });
    }

    let appleUrl: string | null = null;
    let googleUrl: string | null = null;
    let stub = false;

    if (pass.walletRef) {
      const links = this.wallet.linksFor(pass.walletRef);
      appleUrl = links.appleUrl;
      googleUrl = links.googleUrl;
      stub = pass.walletRef.startsWith('stub-');
    } else {
      try {
        const issued = await this.wallet.issuePass({
          serialNumber: pass.serialNumber,
          points: pass.points,
          holderName: user.name,
          organizationName: name,
          maxStamps,
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
        pass = await this.prisma.pass.update({
          where: { id: pass.id },
          data: { walletRef: issued.walletRef },
          include: { user: true },
        });
      } catch (err) {
        console.error('Demo Onda Spa issue failed', err);
      }
    }

    const state = this.passState(pass);
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

    const phone = devicePhone(deviceId);
    const serial = deviceSerial(deviceId);
    const { promo, maxStamps } = DEMO_STORE;

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new BadRequestException('Activa la tarjeta primero');
    }

    const pass = await this.prisma.pass.findFirst({
      where: { userId: user.id, serialNumber: serial },
      include: { user: true },
    });
    if (!pass) {
      throw new BadRequestException('Activa la tarjeta primero');
    }

    if (redeemedThisCycle(pass.points)) {
      const state = this.passState(pass);
      return { ...state, action: 'already_redeemed' as const };
    }

    if (pass.points < maxStamps) {
      const updated = await this.prisma.pass.update({
        where: { id: pass.id },
        data: { points: { increment: 1 } },
        include: { user: true },
      });

      if (updated.walletRef) {
        try {
          await this.wallet.updatePoints(updated.walletRef, updated.points);
        } catch (err) {
          console.error('Demo pulse wallet update failed', err);
        }
      }

      const state = this.passState(updated);
      return { ...state, action: 'accumulated' as const };
    }

    const updatedPass = await this.prisma.pass.update({
      where: { id: pass.id },
      data: { points: 0 },
      include: { user: true },
    });

    if (updatedPass.walletRef) {
      try {
        await this.wallet.updatePoints(updatedPass.walletRef, updatedPass.points);
        await this.wallet.notify(updatedPass.walletRef, REDEEM_MESSAGE);
      } catch (err) {
        console.error('Demo redeem wallet update failed', err);
      }
    }

    const state = this.passState(updatedPass);
    return {
      ...state,
      action: 'redeemed' as const,
      notification: REDEEM_MESSAGE,
    };
  }
}
