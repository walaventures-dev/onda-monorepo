import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { BrevoService } from './brevo.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { CartillaService } from './cartilla.service';

export type RedeemInput = {
  storeId: string;
  pendingRequestId?: string;
  passId?: string;
  promotionId?: string;
};

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

@Injectable()
export class RedeemService {
  private readonly logger = new Logger(RedeemService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(BrevoService) private brevo: BrevoService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  async findActiveClaim(storeId: string, passId: string) {
    return this.prisma.pendingRequest.findFirst({
      where: {
        storeId,
        passId,
        type: 'CLAIM',
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async redeem(input: RedeemInput) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: input.storeId },
    });

    let passId = input.passId;
    let promotionId = input.promotionId;
    let pendingId = input.pendingRequestId;

    if (pendingId) {
      const pending = await this.prisma.pendingRequest.findUniqueOrThrow({
        where: { id: pendingId },
      });
      if (pending.storeId !== store.id) {
        throw new ForbiddenException('Esta solicitud no es de esta sede');
      }
      if (pending.type !== 'CLAIM') {
        throw new BadRequestException('Esta solicitud no es de reclamo');
      }
      if (pending.status !== 'PENDING') {
        throw new BadRequestException('Esta solicitud ya no está pendiente');
      }
      if (pending.expiresAt < new Date()) {
        await this.prisma.pendingRequest.update({
          where: { id: pending.id },
          data: { status: 'REJECTED', resolvedAt: new Date() },
        });
        throw new BadRequestException(
          'Código expirado, el cliente debe pedir uno nuevo'
        );
      }
      if (!pending.promotionId) {
        throw new BadRequestException('Solicitud de reclamo sin promoción asociada');
      }
      passId = pending.passId;
      promotionId = pending.promotionId;
    }

    if (!passId || !promotionId) {
      throw new BadRequestException('Falta el premio a reclamar');
    }
    const resolvedPassId = passId;
    const resolvedPromoId = promotionId;

    const { pass: currentPass, promo, assignment } =
      await this.cartillas.assertCanRedeem(resolvedPassId, resolvedPromoId);
    if (currentPass.storeId !== store.id) {
      throw new ForbiddenException('Este pase no es de esta sede');
    }

    const need = assignment.pointsRequired;
    const isFinalReward = need === store.maxStamps;

    const { confirmedIds } = await this.prisma.$transaction(async (tx) => {
      const pendingWhere = {
        passId: resolvedPassId,
        storeId: store.id,
        type: 'CLAIM' as const,
        status: 'PENDING' as const,
        ...(pendingId ? { id: pendingId } : { promotionId: resolvedPromoId }),
      };
      const pendings = await tx.pendingRequest.findMany({
        where: pendingWhere,
        select: { id: true },
      });
      if (pendingId && pendings.length === 0) {
        throw new BadRequestException('Esta solicitud ya no está pendiente');
      }
      if (pendings.length) {
        await tx.pendingRequest.updateMany({
          where: { id: { in: pendings.map((p) => p.id) } },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        });
      }

      const live = await tx.pass.findUniqueOrThrow({
        where: { id: resolvedPassId },
      });
      if (live.points < need) {
        throw new BadRequestException('Aún no alcanzas este premio');
      }
      const alreadyClaimed = await tx.transaction.findFirst({
        where: {
          passId: resolvedPassId,
          promotionId: resolvedPromoId,
          type: 'REDEEM',
          createdAt: { gte: live.cycleStartedAt },
        },
      });
      if (alreadyClaimed) {
        throw new BadRequestException('Ya reclamaste este premio en este ciclo');
      }

      const lastAccumulate = await tx.transaction.findFirst({
        where: {
          passId: resolvedPassId,
          storeId: store.id,
          type: 'ACCUMULATE',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      await tx.transaction.create({
        data: {
          passId: resolvedPassId,
          storeId: store.id,
          type: 'REDEEM',
          points: need,
          promotionId: resolvedPromoId,
          cartillaId: live.cartillaId,
          ...(lastAccumulate ? { accumulateId: lastAccumulate.id } : {}),
        },
      });
      await tx.pass.update({
        where: { id: resolvedPassId },
        data: isFinalReward ? { points: 0, cycleStartedAt: new Date() } : {},
      });
      return { confirmedIds: pendings.map((p) => p.id) };
    });

    const full = await this.prisma.pass.findUniqueOrThrow({
      where: { id: resolvedPassId },
      include: { user: true },
    });
    const message =
      `${clip(store.name, 40)}: reclamaste ${clip(promo.title, 70)}.`.slice(
        0,
        160
      );

    if (full.walletRef) {
      await this.wallet.updatePoints(full.walletRef, full.points, message);
    }
    try {
      await this.brevo.sendSms({ to: full.user.phone, message });
    } catch (err) {
      this.logger.warn(
        `SMS reclamo falló para ${full.id}: ${
          err instanceof Error ? err.message : err
        }`
      );
    }

    if (confirmedIds.length) {
      this.sse.emit(store.id, { kind: 'resolved', ids: confirmedIds });
    }

    return {
      kind: 'redeem' as const,
      pass: full,
      points: full.points,
      promotion: { id: promo.id, title: promo.title },
      message,
    };
  }
}
