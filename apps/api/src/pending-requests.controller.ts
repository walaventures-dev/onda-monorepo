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
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';

const CODE_TTL_MS = 10 * 60 * 1000;

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
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService
  ) {}

  @Sse('stream')
  stream(@Query('storeId') storeId: string): Observable<MessageEvent> {
    return this.sse.stream(storeId);
  }

  @Get('pending')
  listPending(@Query('storeId') storeId: string) {
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

    const existing = await this.prisma.pendingRequest.findFirst({
      where: { passId: pass.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.expiresAt > new Date()) {
        return existing;
      }
      await this.prisma.pendingRequest.update({
        where: { id: existing.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
    }

    let promotion: { id: string; title: string; pointsRequired: number; storeId: string | null } | null = null;
    if (body.type === 'CLAIM') {
      if (!body.promotionId) throw new BadRequestException('Falta la promoción a reclamar');
      promotion = await this.prisma.promotion.findUniqueOrThrow({ where: { id: body.promotionId } });
      if (promotion.storeId !== storeId) {
        throw new BadRequestException('Promoción no pertenece a este negocio');
      }
      if (promotion.pointsRequired !== pass.points) {
        throw new BadRequestException('Aún no alcanzas este premio');
      }
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

    const devMode = !process.env.KAPSO_API_KEY;
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

    return devMode ? { ...created, devCode: code } : created;
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
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
      await this.prisma.$transaction([
        this.prisma.pass.update({
          where: { id: pending.passId },
          data: { points: { increment: 1 } },
        }),
        this.prisma.transaction.create({
          data: { passId: pending.passId, storeId: pending.storeId, type: 'ACCUMULATE', points: 1 },
        }),
        this.prisma.pendingRequest.update({
          where: { id },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        }),
      ]);
    } else {
      const promotion = await this.prisma.promotion.findUniqueOrThrow({
        where: { id: pending.promotionId as string },
      });
      const store = await this.prisma.store.findUniqueOrThrow({ where: { id: pending.storeId } });
      const isFinalReward = promotion.pointsRequired === store.maxStamps;

      await this.prisma.$transaction([
        this.prisma.transaction.create({
          data: {
            passId: pending.passId,
            storeId: pending.storeId,
            type: 'REDEEM',
            points: promotion.pointsRequired,
            promotionId: promotion.id,
          },
        }),
        this.prisma.pass.update({
          where: { id: pending.passId },
          data: isFinalReward ? { points: 0, cycleStartedAt: new Date() } : {},
        }),
        this.prisma.pendingRequest.update({
          where: { id },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        }),
      ]);
    }

    return { ok: true as const };
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    await this.prisma.pendingRequest.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });
    return { ok: true as const };
  }
}
