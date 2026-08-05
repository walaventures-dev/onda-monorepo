import { Inject, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { CustomerAuthService } from './customer-auth.service';

function randomSerial() {
  return `ONDA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new Error('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('passes')
export class PassesController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService
  ) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        store: { include: { passDesign: true, promotions: true } },
        event: { include: { passDesign: true, promotions: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    const claimedThisCycle = await this.prisma.transaction.findMany({
      where: {
        passId: id,
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

  @Get()
  byUser(@Query('userId') userId: string, @Query('storeId') storeId?: string) {
    return this.prisma.pass.findMany({
      where: { userId, ...(storeId ? { storeId } : {}) },
      include: {
        store: { include: { passDesign: true } },
        event: { include: { passDesign: true } },
      },
    });
  }

  @Post(':id/issue')
  async issue(@Param('id') id: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        store: { include: { passDesign: true } },
        event: { include: { passDesign: true } },
      },
    });
    const design =
      pass.store?.passDesign ||
      pass.event?.passDesign ||
      ({
        title: 'Onda',
        subtitle: 'Loyalty',
        description: '',
        backgroundColor: '#6E5AE6',
        foregroundColor: '#FFFFFF',
        labelColor: '#E5F6FC',
        logoUrl: null,
      } as const);

    const issued = await this.wallet.issuePass({
      serialNumber: pass.serialNumber,
      points: pass.points,
      holderName: pass.user.name,
      design,
    });

    await this.prisma.pass.update({
      where: { id },
      data: { walletRef: issued.walletRef },
    });

    return issued;
  }

  @Post('store/:storeId/claim')
  async claimStorePass(
    @Param('storeId') storeId: string,
    @Headers('authorization') authHeader: string
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));

    let pass = await this.prisma.pass.findFirst({ where: { userId: user.id, storeId } });
    if (!pass) {
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId,
          serialNumber: randomSerial(),
          points: 0,
        },
      });
    }

    return this.prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
      include: { store: { include: { passDesign: true, promotions: true } } },
    });
  }
}
