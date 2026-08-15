import { Inject, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { WhatsappService } from './whatsapp.service';
import { assertCanAccumulate } from './plan-quota';
import { CartillaService } from './cartilla.service';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(WhatsappService) private whatsapp: WhatsappService,
    @Inject(CartillaService) private cartillas: CartillaService
  ) {}

  @Post('accumulate')
  async accumulate(
    @Body() body: { passId: string; storeId: string; points?: number }
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: body.storeId },
    });
    const requestedPoints = body.points ?? 1;
    const { pass, tx } = await this.prisma.$transaction(async (trx) => {
      const allowed = await assertCanAccumulate(trx, store.id, requestedPoints);
      const current = await trx.pass.findUniqueOrThrow({ where: { id: body.passId } });
      const delta = Math.max(0, Math.min(allowed, store.maxStamps - current.points));
      const updated = await trx.pass.update({
        where: { id: body.passId },
        data: { points: { increment: delta } },
        include: { user: true },
      });
      const created = await trx.transaction.create({
        data: {
          passId: updated.id,
          storeId: store.id,
          type: 'ACCUMULATE',
          points: delta,
          cartillaId: current.cartillaId,
        },
      });
      return { pass: updated, tx: created };
    });
    if (pass.walletRef) {
      await this.wallet.updatePoints(pass.walletRef, pass.points);
    }
    await this.whatsapp.enqueue({
      to: pass.user.phone,
      template: 'onda_puntos',
      variables: {
        name: pass.user.name,
        points: String(pass.points),
        store: store.name,
      },
      storeId: store.id,
    });
    await this.prisma.store.update({
      where: { id: store.id },
      data: { whatsappUsed: { increment: 1 } },
    });
    return { transaction: tx, pass };
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
    const { pass: currentPass, promo, assignment } = await this.cartillas.assertCanRedeem(
      body.passId,
      body.promotionId
    );
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
