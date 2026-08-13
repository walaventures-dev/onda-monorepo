import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';
import { WalletService } from './wallet.service';
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { assertCanAccumulate } from './plan-quota';
import { CartillaService } from './cartilla.service';

const CODE_TTL_MS = 60 * 1000;

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new ForbiddenException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('pending-requests')
export class PendingRequestsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  @Sse('stream')
  async stream(
    @Query('storeId') storeId: string
  ): Promise<Observable<MessageEvent>> {
    await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    return this.sse.stream(storeId);
  }

  @Get('pending')
  async listPending(@Query('storeId') storeId: string) {
    await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    return this.prisma.pendingRequest.findMany({
      where: { storeId, status: 'PENDING' },
      include: { pass: { include: { user: true } }, promotion: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('mine')
  async mine(
    @Headers('authorization') authHeader: string,
    @Query('passId') passId: string
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const pass = await this.prisma.pass.findUniqueOrThrow({ where: { id: passId } });
    if (pass.userId !== user.id) throw new ForbiddenException('Este pase no es tuyo');

    // Sin filtro de status: el front necesita ver el cambio PENDING -> CONFIRMED/REJECTED
    // de la misma fila para saber cómo se resolvió, no solo que ya no está pendiente.
    return this.prisma.pendingRequest.findFirst({
      where: { passId },
      include: { promotion: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: { passId: string; type: 'ACCUMULATE' | 'CLAIM'; promotionId?: string }
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: body.passId },
      include: { user: true },
    });
    if (pass.userId !== user.id) throw new ForbiddenException('Este pase no es tuyo');
    if (!pass.storeId) throw new BadRequestException('Pase sin negocio asociado');
    const storeId = pass.storeId;
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId } });

    if (body.type === 'ACCUMULATE') {
      await assertCanAccumulate(this.prisma, storeId, 1);
    }
    if (body.type === 'ACCUMULATE' && pass.points >= store.maxStamps) {
      const assignment = await this.prisma.passPromoAssignment.findFirst({
        where: {
          passId: pass.id,
          cartillaId: pass.cartillaId || undefined,
          pointsRequired: store.maxStamps,
        },
      });
      if (assignment) {
        throw new BadRequestException('Ya alcanzaste el máximo de sellos de este ciclo, reclama tu premio primero');
      }
    }

    const existing = await this.prisma.pendingRequest.findFirst({
      where: {
        passId: pass.id,
        status: 'PENDING',
        type: body.type,
        ...(body.type === 'CLAIM' ? { promotionId: body.promotionId } : {}),
      },
      include: { promotion: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.expiresAt > new Date()) {
        const { promotion: existingPromotion, ...existingRest } = existing;
        return { ...existingRest, promotionTitle: existingPromotion?.title };
      }
      await this.prisma.pendingRequest.update({
        where: { id: existing.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
    }

    let promotion: {
      id: string;
      title: string;
      pointsRequired: number;
      storeId: string | null;
      isActive: boolean;
      maxRedemptions: number | null;
    } | null = null;
    if (body.type === 'CLAIM') {
      if (!body.promotionId) throw new BadRequestException('Falta la promoción a reclamar');
      const checked = await this.cartillas.assertCanRedeem(pass.id, body.promotionId);
      promotion = checked.promo;
      const alreadyClaimed = await this.prisma.transaction.findFirst({
        where: {
          passId: pass.id,
          promotionId: promotion.id,
          type: 'REDEEM',
          createdAt: { gte: pass.cycleStartedAt },
        },
      });
      if (alreadyClaimed) {
        throw new BadRequestException('Ya reclamaste este premio en este ciclo');
      }
    }

    const code = randomCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    const created = await this.prisma.pendingRequest.create({
      data: {
        type: body.type,
        code,
        passId: pass.id,
        storeId,
        promotionId: promotion?.id,
        expiresAt,
      },
    });

    const devMode = process.env.NODE_ENV !== 'production' && !process.env.KAPSO_API_KEY;
    if (!devMode) {
      await this.whatsapp.enqueue({
        to: pass.user.phone,
        template: 'onda_confirmar_codigo',
        variables: { code },
        storeId,
      });
    }

    this.sse.emit(storeId, {
      id: created.id,
      type: created.type,
      code: created.code,
      customerName: pass.user.name,
      promotionTitle: promotion?.title,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });

    const response = { ...created, promotionTitle: promotion?.title };
    return devMode ? { ...response, devCode: code } : response;
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: pending.storeId } });
    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRequest.update({
        where: { id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
      throw new BadRequestException('Código expirado, el cliente debe pedir uno nuevo');
    }

    if (pending.type === 'ACCUMULATE') {
      await this.prisma.$transaction(async (tx) => {
        const allowed = await assertCanAccumulate(tx, pending.storeId, 1);
        const claimed = await tx.pendingRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Esta solicitud ya no está pendiente');
        }
        const current = await tx.pass.findUniqueOrThrow({ where: { id: pending.passId } });
        const delta = Math.max(0, Math.min(allowed, store.maxStamps - current.points));
        await tx.pass.update({
          where: { id: pending.passId },
          data: { points: { increment: delta } },
        });
        await tx.transaction.create({
          data: {
            passId: pending.passId,
            storeId: pending.storeId,
            type: 'ACCUMULATE',
            points: delta,
            cartillaId: current.cartillaId,
          },
        });
      });
    } else {
      if (!pending.promotionId) {
        throw new BadRequestException('Solicitud de reclamo sin promoción asociada');
      }
      const promotion = await this.prisma.promotion.findUniqueOrThrow({
        where: { id: pending.promotionId },
      });
      const { assignment } = await this.cartillas.assertCanRedeem(
        pending.passId,
        promotion.id
      );
      const need = assignment.pointsRequired;
      const isFinalReward = need === store.maxStamps;

      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.pendingRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Esta solicitud ya no está pendiente');
        }
        const currentPass = await tx.pass.findUniqueOrThrow({ where: { id: pending.passId } });
        if (currentPass.points < need) {
          throw new BadRequestException('Aún no alcanzas este premio');
        }
        const alreadyClaimed = await tx.transaction.findFirst({
          where: {
            passId: pending.passId,
            promotionId: promotion.id,
            type: 'REDEEM',
            createdAt: { gte: currentPass.cycleStartedAt },
          },
        });
        if (alreadyClaimed) {
          throw new BadRequestException('Ya reclamaste este premio en este ciclo');
        }
        await tx.transaction.create({
          data: {
            passId: pending.passId,
            storeId: pending.storeId,
            type: 'REDEEM',
            points: need,
            promotionId: promotion.id,
            cartillaId: currentPass.cartillaId,
          },
        });
        await tx.pass.update({
          where: { id: pending.passId },
          data: isFinalReward ? { points: 0, cycleStartedAt: new Date() } : {},
        });
      });
    }

    const updatedPass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: pending.passId },
      include: { user: true },
    });
    if (updatedPass.walletRef) {
      await this.wallet.updatePoints(updatedPass.walletRef, updatedPass.points);
    }
    if (pending.type === 'ACCUMULATE') {
      await this.whatsapp.enqueue({
        to: updatedPass.user.phone,
        template: 'onda_puntos',
        variables: {
          name: updatedPass.user.name,
          points: String(updatedPass.points),
          store: store.name,
        },
        storeId: pending.storeId,
      });
      await this.prisma.store.update({
        where: { id: store.id },
        data: { whatsappUsed: { increment: 1 } },
      });
    }

    return { ok: true as const };
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    const updateResult = await this.prisma.pendingRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });
    if (updateResult.count === 0) {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    return { ok: true as const };
  }
}
