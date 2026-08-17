import { Inject, Body, Controller, Headers, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { CartillaService } from './cartilla.service';
import { AccumulateService } from './accumulate.service';
import { StoreAccessService } from './store-access.service';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(CartillaService) private cartillas: CartillaService,
    @Inject(AccumulateService) private accumulate: AccumulateService,
    @Inject(StoreAccessService) private access: StoreAccessService
  ) {}

  @Post('accumulate')
  async accumulate(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { passId: string; storeId: string }
  ) {
    await this.access.requireStore(body.storeId, authHeader);
    const result = await this.accumulate.accumulate({
      storeId: body.storeId,
      passId: body.passId,
    });
    return { pass: result.pass, points: result.points, next: result.next };
  }

  @Post('redeem')
  async redeem(
    @Body()
    body: {
      passId: string;
      storeId: string;
      promotionId: string;
    }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    const { pass: currentPass, promo, assignment } =
      await this.cartillas.assertCanRedeem(body.passId, body.promotionId);
    const pass = await this.prisma.pass.update({
      where: { id: body.passId },
      data: { points: { decrement: assignment.pointsRequired } },
      include: { user: true },
    });
    const tx = await this.prisma.transaction.create({
      data: {
        passId: pass.id,
        storeId: store.id,
        type: 'REDEEM',
        points: assignment.pointsRequired,
        promotionId: promo.id,
        cartillaId: currentPass.cartillaId,
      },
    });
    if (pass.walletRef) {
      await this.wallet.updatePoints(pass.walletRef, pass.points);
    }
    return { transaction: tx, pass, promotion: promo };
  }
}
