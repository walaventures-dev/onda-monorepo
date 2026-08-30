import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from './prisma.service';
import { StoreAccessService } from './store-access.service';
import { AccumulateService } from './accumulate.service';
import { RedeemService } from './redeem.service';
import { parseCajaQr } from '@onda/shared-utils';

function cajaPublicUrl(token: string) {
  const base = (
    process.env.NEXT_PUBLIC_CAJA_URL || 'http://localhost:4204'
  ).replace(/\/$/, '');
  return `${base}/c/${token}`;
}

function newCajaToken() {
  return randomBytes(24).toString('base64url');
}

@Controller('caja')
export class CajaController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(StoreAccessService) private access: StoreAccessService,
    @Inject(AccumulateService) private accumulate: AccumulateService,
    @Inject(RedeemService) private redeem: RedeemService
  ) {}

  @Get('session')
  async session(
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') queryToken?: string
  ) {
    const token = queryToken || this.access.bearerToken(authHeader);
    if (!token) throw new UnauthorizedException('Falta el enlace de caja');
    const link = await this.access.resolveCajaToken(token);
    return {
      storeId: link.store.id,
      storeName: link.store.name,
      currency: link.store.currency || 'COP',
      ondaValue: link.store.ondaValue ?? null,
      maxStamps: link.store.maxStamps,
      posEnabled: Boolean(link.store.posEnabled),
    };
  }

  @Post('link')
  async link(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { storeId: string; rotate?: boolean }
  ) {
    await this.access.requireStore(body.storeId, authHeader);
    if (body.rotate) {
      await this.prisma.cajaLink.updateMany({
        where: { storeId: body.storeId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      const existing = await this.prisma.cajaLink.findFirst({
        where: { storeId: body.storeId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return { url: cajaPublicUrl(existing.token), token: existing.token };
      }
    }
    const created = await this.prisma.cajaLink.create({
      data: { storeId: body.storeId, token: newCajaToken() },
    });
    return { url: cajaPublicUrl(created.token), token: created.token };
  }

  @Post('scan')
  async scan(
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Body()
    body: {
      serialNumber?: string;
      payload?: string;
      paymentAmount?: number;
      points?: number;
      benefitAmount?: number;
    }
  ) {
    const token = queryToken || this.access.bearerToken(authHeader);
    if (!token) throw new UnauthorizedException('Falta el enlace de caja');
    const link = await this.access.resolveCajaToken(token);
    const raw = (body.payload || body.serialNumber || '').trim();
    if (!raw) throw new BadRequestException('Falta el código del pase');

    const scanned = parseCajaQr(raw);
    if (scanned.kind === 'claim') {
      const pending = await this.prisma.pendingRequest.findUnique({
        where: { id: scanned.pendingRequestId },
        include: {
          promotion: {
            select: { id: true, title: true, type: true, value: true },
          },
        },
      });
      const promoType = pending?.promotion?.type;
      const needsTicket = promoType === 'PERCENT_OFF';
      const needsBenefit =
        promoType === 'OTHER' &&
        !(pending?.promotion?.value != null && pending.promotion.value > 0);

      if (needsTicket && body.paymentAmount == null) {
        return {
          kind: 'claim' as const,
          pendingRequestId: scanned.pendingRequestId,
          promotion: pending?.promotion || null,
          ondaValue: link.store.ondaValue ?? null,
          needsPaymentAmount: true,
          needsBenefitAmount: false,
        };
      }
      if (needsBenefit && body.benefitAmount == null) {
        return {
          kind: 'claim' as const,
          pendingRequestId: scanned.pendingRequestId,
          promotion: pending?.promotion || null,
          ondaValue: link.store.ondaValue ?? null,
          needsPaymentAmount: false,
          needsBenefitAmount: true,
        };
      }

      return this.redeem.redeem({
        storeId: link.storeId,
        pendingRequestId: scanned.pendingRequestId,
        paymentAmount: body.paymentAmount,
        benefitAmount: body.benefitAmount,
      });
    }

    const pass = await this.prisma.pass.findUnique({
      where: { serialNumber: scanned.serialNumber },
      include: { user: { select: { name: true } } },
    });
    if (!pass) throw new BadRequestException('Pase no encontrado');
    if (pass.storeId !== link.storeId) {
      throw new ForbiddenException('Este pase no es de esta sede');
    }

    const hasOndaValue =
      link.store.ondaValue != null && Number(link.store.ondaValue) > 0;
    const needsManualPoints = !hasOndaValue;
    const readyToAccumulate = body.paymentAmount != null;

    if (!readyToAccumulate) {
      return {
        kind: 'accumulate' as const,
        pass: {
          user: { name: pass.user?.name },
          points: pass.points,
        },
        ondaValue: link.store.ondaValue ?? null,
        maxStamps: link.store.maxStamps,
        needsPoints: needsManualPoints,
      };
    }

    const result = await this.accumulate.accumulate({
      storeId: link.storeId,
      serialNumber: scanned.serialNumber,
      paymentAmount: body.paymentAmount,
      points: body.points,
    });
    return { kind: 'accumulated' as const, ...result };
  }
}
