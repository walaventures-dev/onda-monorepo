import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Header,
  Inject,
  Logger,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { assertCanAccumulate } from './plan-quota';
import { CartillaService } from './cartilla.service';
import { AccumulateService } from './accumulate.service';
import { RedeemService } from './redeem.service';
import { StoreAccessService } from './store-access.service';
import { claimQrPayload } from '@onda/shared-utils';

const CODE_TTL_MS = 60 * 1000;

function pendingQrPayload(type: 'ACCUMULATE' | 'CLAIM', id: string, serialNumber: string) {
  return type === 'CLAIM' ? claimQrPayload(id) : serialNumber;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new ForbiddenException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

async function uniqueTwoDigitCode(
  prisma: PrismaService,
  storeId: string
): Promise<string> {
  const taken = new Set(
    (
      await prisma.pendingRequest.findMany({
        where: {
          storeId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        select: { code: true },
      })
    ).map((row) => row.code)
  );
  for (let i = 0; i < 80; i++) {
    const code = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    if (!taken.has(code)) return code;
  }
  throw new BadRequestException(
    'Demasiadas solicitudes pendientes, espera un momento'
  );
}

@Controller('pending-requests')
export class PendingRequestsController {
  private readonly logger = new Logger(PendingRequestsController.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService,
    @Inject(CartillaService) private cartillas: CartillaService,
    @Inject(AccumulateService) private accumulate: AccumulateService,
    @Inject(RedeemService) private redeem: RedeemService,
    @Inject(StoreAccessService) private access: StoreAccessService
  ) {}

  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  async stream(
    @Headers('authorization') authHeader: string | undefined,
    @Query('storeId') storeId: string,
    @Query('token') token?: string
  ): Promise<Observable<MessageEvent>> {
    await this.access.requireStore(storeId, authHeader, token);
    return this.sse.stream(storeId);
  }

  @Get('pending')
  async listPending(
    @Headers('authorization') authHeader: string | undefined,
    @Query('storeId') storeId: string,
    @Query('token') token?: string
  ) {
    await this.access.requireStore(storeId, authHeader, token);
    return this.prisma.pendingRequest.findMany({
      where: {
        storeId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
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
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: passId },
    });
    if (pass.userId !== user.id) {
      throw new ForbiddenException('Este pase no es tuyo');
    }

    // Sin filtro de status: el front necesita ver el cambio PENDING -> CONFIRMED/REJECTED
    // de la misma fila para saber cómo se resolvió, no solo que ya no está pendiente.
    const row = await this.prisma.pendingRequest.findFirst({
      where: { passId },
      include: { promotion: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return {
      ...row,
      promotionTitle: row.promotion?.title,
      serialNumber: pass.serialNumber,
      qrPayload: pendingQrPayload(row.type, row.id, pass.serialNumber),
    };
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body()
    body: { passId: string; type: 'ACCUMULATE' | 'CLAIM'; promotionId?: string }
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: body.passId },
      include: { user: true },
    });
    if (pass.userId !== user.id) {
      throw new ForbiddenException('Este pase no es tuyo');
    }
    if (!pass.storeId) throw new BadRequestException('Pase sin negocio asociado');
    const storeId = pass.storeId;
    const active = await this.cartillas.resolveActiveCartilla(storeId);
    const current = await this.prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
      include: { user: true },
    });
    if (current.cartillaId !== active.id) {
      throw new BadRequestException(
        'Tu cartilla se actualizó. Recarga para ver la vigente.'
      );
    }
    const maxStamps = active.maxStamps;

    if (body.type === 'ACCUMULATE') {
      await assertCanAccumulate(this.prisma, storeId, 1);
    }
    if (body.type === 'ACCUMULATE' && current.points >= maxStamps) {
      const assignment = await this.prisma.passPromoAssignment.findFirst({
        where: {
          passId: current.id,
          cartillaId: current.cartillaId || undefined,
          pointsRequired: maxStamps,
        },
      });
      if (assignment) {
        throw new BadRequestException(
          'Ya alcanzaste el máximo de sellos de este ciclo, reclama tu premio primero'
        );
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
        return {
          ...existingRest,
          promotionTitle: existingPromotion?.title,
          serialNumber: pass.serialNumber,
          qrPayload: pendingQrPayload(existing.type, existing.id, pass.serialNumber),
          ...(process.env.NODE_ENV !== 'production' ? { devCode: existing.code } : {}),
        };
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
      if (!body.promotionId) {
        throw new BadRequestException('Falta la promoción a reclamar');
      }
      const checked = await this.cartillas.assertCanRedeem(
        pass.id,
        body.promotionId
      );
      promotion = checked.promo;
      const alreadyClaimed = await this.prisma.transaction.findFirst({
        where: {
          passId: pass.id,
          promotionId: promotion.id,
          type: 'REDEEM',
          createdAt: { gte: current.cycleStartedAt },
        },
      });
      if (alreadyClaimed) {
        throw new BadRequestException('Ya reclamaste este premio en este ciclo');
      }
    }

    const code = await uniqueTwoDigitCode(this.prisma, storeId);
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

    if (process.env.NODE_ENV === 'production') {
      try {
        await this.whatsapp.enqueue({
          to: pass.user.phone,
          template: 'onda_confirmar_codigo',
          variables: { code },
          storeId,
        });
      } catch (err) {
        this.logger.warn(
          `WhatsApp código pendiente falló: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }

    this.sse.emit(storeId, {
      kind: 'created',
      id: created.id,
      type: created.type,
      code: created.code,
      customerName: pass.user.name,
      promotionTitle: promotion?.title,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });

    return {
      ...created,
      promotionTitle: promotion?.title,
      serialNumber: pass.serialNumber,
      qrPayload: pendingQrPayload(created.type, created.id, pass.serialNumber),
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') token?: string,
    @Body() body?: { paymentAmount?: number }
  ) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({
      where: { id },
    });
    await this.access.requireStore(pending.storeId, authHeader, token);

    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRequest.update({
        where: { id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
      throw new BadRequestException(
        'Código expirado, el cliente debe pedir uno nuevo'
      );
    }

    if (pending.type === 'ACCUMULATE') {
      await this.accumulate.accumulate({
        storeId: pending.storeId,
        passId: pending.passId,
        pendingRequestId: pending.id,
        paymentAmount: body?.paymentAmount,
      });
      return { ok: true as const };
    }

    await this.redeem.redeem({
      storeId: pending.storeId,
      pendingRequestId: pending.id,
    });
    return { ok: true as const };
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') token?: string
  ) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({
      where: { id },
    });
    await this.access.requireStore(pending.storeId, authHeader, token);
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
    this.sse.emit(pending.storeId, { kind: 'resolved', ids: [pending.id] });
    return { ok: true as const };
  }
}
