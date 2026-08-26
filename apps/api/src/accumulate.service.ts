import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ondasFromPayment, parsePositiveInt } from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { assertCanAccumulate } from './plan-quota';

const DOUBLE_SCAN_MS = 15_000;

export type AccumulateInput = {
  storeId: string;
  passId?: string;
  serialNumber?: string;
  pendingRequestId?: string;
  paymentAmount?: number;
  /** Cantidad manual de ondas (obligatoria si el store no tiene ondaValue). */
  points?: number;
};

export function parsePaymentAmount(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

type NextReward = {
  title: string;
  pointsRequired: number;
  ready: boolean;
};

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

function pickNextReward(input: {
  points: number;
  cycleStartedAt: Date;
  promoAssignments: Array<{
    pointsRequired: number;
    promotionId: string;
    promotion: { title: string; isActive: boolean };
  }>;
  redemptions: Array<{ promotionId: string | null; createdAt: Date }>;
}): NextReward | null {
  const claimed = new Set(
    input.redemptions
      .filter(
        (t) =>
          t.promotionId && t.createdAt.getTime() >= input.cycleStartedAt.getTime()
      )
      .map((t) => t.promotionId as string)
  );
  const rewards = input.promoAssignments
    .filter((a) => a.promotion?.isActive)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
  const ready = rewards.find(
    (r) => input.points >= r.pointsRequired && !claimed.has(r.promotionId)
  );
  if (ready) {
    return {
      title: ready.promotion.title,
      pointsRequired: ready.pointsRequired,
      ready: true,
    };
  }
  const next = rewards.find((r) => input.points < r.pointsRequired);
  if (next) {
    return {
      title: next.promotion.title,
      pointsRequired: next.pointsRequired,
      ready: false,
    };
  }
  return null;
}

export function buildAccumulateMessage(
  storeName: string,
  delta: number,
  points: number,
  maxStamps: number,
  next: NextReward | null
) {
  const deltaLabel = delta === 1 ? '+1 onda' : `+${delta} ondas`;
  const head = `${clip(storeName, 40)}: ${deltaLabel} (${points}/${maxStamps})`;
  let tail = '';
  if (next?.ready) {
    tail = `. Ya puedes reclamar ${clip(next.title, 50)}`;
  } else if (next) {
    tail = `. Próximo: ${clip(next.title, 40)} en onda ${next.pointsRequired}`;
  }
  return `${head}${tail}.`.slice(0, 160);
}

function resolveRequestedOndas(input: {
  paymentAmount?: number;
  points?: number;
  ondaValue?: number | null;
}): number {
  const ondaValue =
    input.ondaValue != null && Number(input.ondaValue) > 0
      ? Number(input.ondaValue)
      : null;

  if (ondaValue != null) {
    if (input.paymentAmount == null || !(input.paymentAmount > 0)) {
      throw new BadRequestException('Indica el valor de la cuenta');
    }
    const auto = ondasFromPayment(input.paymentAmount, ondaValue);
    if (auto <= 0) {
      throw new BadRequestException(
        `El monto no alcanza para 1 onda (mínimo ${Math.ceil(ondaValue)} COP)`
      );
    }
    return auto;
  }

  const manual = parsePositiveInt(input.points);
  if (manual == null) {
    throw new BadRequestException(
      'Indica cuántas ondas acumular (o configura el valor de una onda)'
    );
  }
  if (input.paymentAmount == null || !(input.paymentAmount > 0)) {
    throw new BadRequestException('Indica el valor de la cuenta');
  }
  return manual;
}

@Injectable()
export class AccumulateService {
  private readonly logger = new Logger(AccumulateService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService
  ) {}

  async accumulate(input: AccumulateInput) {
    const paymentAmount = parsePaymentAmount(input.paymentAmount);
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: input.storeId },
    });

    const requested = resolveRequestedOndas({
      paymentAmount,
      points: input.points,
      ondaValue: store.ondaValue,
    });

    const serial = input.serialNumber?.trim();
    const pass = input.passId
      ? await this.prisma.pass.findUnique({ where: { id: input.passId } })
      : serial
        ? await this.prisma.pass.findUnique({ where: { serialNumber: serial } })
        : null;

    if (!pass) {
      throw new BadRequestException('Pase no encontrado');
    }
    if (pass.storeId !== store.id) {
      throw new ForbiddenException('Este pase no es de esta sede');
    }

    if (input.pendingRequestId) {
      const pending = await this.prisma.pendingRequest.findUniqueOrThrow({
        where: { id: input.pendingRequestId },
      });
      if (pending.storeId !== store.id || pending.passId !== pass.id) {
        throw new ForbiddenException('Esta solicitud no es de esta sede');
      }
      if (pending.type !== 'ACCUMULATE') {
        throw new BadRequestException('Esta solicitud no es de acumulación');
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
    }

    const recent = await this.prisma.transaction.findFirst({
      where: {
        passId: pass.id,
        storeId: store.id,
        type: 'ACCUMULATE',
        createdAt: { gte: new Date(Date.now() - DOUBLE_SCAN_MS) },
      },
    });
    if (recent) {
      throw new BadRequestException('Esta onda ya se acumuló hace un momento');
    }

    const { updatedPass, confirmedIds, delta } = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.pass.findUniqueOrThrow({
          where: { id: pass.id },
        });
        const room = Math.max(0, store.maxStamps - current.points);
        if (room <= 0) {
          throw new BadRequestException(
            'Ya alcanzaste el máximo de sellos de este ciclo, reclama tu premio primero'
          );
        }
        const capped = Math.min(requested, room);
        const allowed = await assertCanAccumulate(tx, store.id, capped);
        const nextDelta = Math.max(0, allowed);
        if (nextDelta <= 0) {
          throw new BadRequestException(
            'Ya alcanzaste el máximo de sellos de este ciclo, reclama tu premio primero'
          );
        }

        const pendingWhere = {
          passId: pass.id,
          storeId: store.id,
          type: 'ACCUMULATE' as const,
          status: 'PENDING' as const,
          ...(input.pendingRequestId ? { id: input.pendingRequestId } : {}),
        };
        const pendings = await tx.pendingRequest.findMany({
          where: pendingWhere,
          select: { id: true },
        });
        if (input.pendingRequestId && pendings.length === 0) {
          throw new BadRequestException('Esta solicitud ya no está pendiente');
        }
        if (pendings.length) {
          await tx.pendingRequest.updateMany({
            where: { id: { in: pendings.map((p) => p.id) } },
            data: { status: 'CONFIRMED', resolvedAt: new Date() },
          });
        }

        const updated = await tx.pass.update({
          where: { id: pass.id },
          data: { points: { increment: nextDelta } },
          include: { user: true },
        });
        await tx.transaction.create({
          data: {
            passId: pass.id,
            storeId: store.id,
            type: 'ACCUMULATE',
            points: nextDelta,
            cartillaId: current.cartillaId,
            ...(paymentAmount != null ? { paymentAmount } : {}),
          },
        });
        return {
          updatedPass: updated,
          confirmedIds: pendings.map((p) => p.id),
          delta: nextDelta,
        };
      }
    );

    const full = await this.prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
      include: {
        user: true,
        cartilla: true,
        promoAssignments: {
          where: { cartillaId: updatedPass.cartillaId || undefined },
          include: { promotion: true },
        },
        transactions: {
          where: {
            type: 'REDEEM',
            createdAt: { gte: updatedPass.cycleStartedAt },
          },
        },
      },
    });
    const maxStamps = full.cartilla?.maxStamps ?? store.maxStamps;
    const next = pickNextReward({
      points: full.points,
      cycleStartedAt: full.cycleStartedAt,
      promoAssignments: full.promoAssignments,
      redemptions: full.transactions,
    });
    const message = buildAccumulateMessage(
      store.name,
      delta,
      full.points,
      maxStamps,
      next
    );

    if (full.walletRef) {
      try {
        await this.wallet.updatePoints(full.walletRef, full.points, message);
      } catch (err) {
        this.logger.warn(
          `Wallet acumulación falló para ${full.id}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }

    if (confirmedIds.length) {
      this.sse.emit(store.id, { kind: 'resolved', ids: confirmedIds });
    }
    this.sse.emit(store.id, {
      kind: 'activity',
      type: 'ACCUMULATE',
      passId: pass.id,
      delta,
    });

    return {
      pass: full,
      points: full.points,
      delta,
      next,
      message,
    };
  }

  async reverseOndas(input: {
    storeId: string;
    passId: string;
    ondasToReverse: number;
    paymentAmount?: number;
  }) {
    const delta = Math.max(0, Math.round(input.ondasToReverse));
    if (delta === 0) return 0;

    const pass = await this.prisma.pass.findFirst({
      where: { id: input.passId, storeId: input.storeId },
      include: { user: true },
    });
    if (!pass) return 0;

    const actual = Math.min(delta, pass.points);
    if (actual === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.pass.update({
        where: { id: pass.id },
        data: { points: { decrement: actual } },
      });
      await tx.transaction.create({
        data: {
          passId: pass.id,
          storeId: input.storeId,
          type: 'ACCUMULATE',
          points: -actual,
          paymentAmount:
            input.paymentAmount != null ? -input.paymentAmount : undefined,
        },
      });
    });

    const updated = await this.prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
    });
    if (updated.walletRef) {
      try {
        await this.wallet.updatePoints(
          updated.walletRef,
          updated.points,
          `Ajuste: -${actual} ondas`
        );
      } catch {
        /* ignore */
      }
    }
    return actual;
  }
}
