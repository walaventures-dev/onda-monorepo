import { Inject, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';

@Controller('passes')
export class PassesController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.pass.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        store: { include: { passDesign: true, promotions: true } },
        event: { include: { passDesign: true, promotions: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
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
}
