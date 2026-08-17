import {
  Body,
  Controller,
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
    @Inject(AccumulateService) private accumulate: AccumulateService
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
    @Body() body: { serialNumber: string }
  ) {
    const token = queryToken || this.access.bearerToken(authHeader);
    if (!token) throw new UnauthorizedException('Falta el enlace de caja');
    const link = await this.access.resolveCajaToken(token);
    return this.accumulate.accumulate({
      storeId: link.storeId,
      serialNumber: body.serialNumber,
    });
  }
}
