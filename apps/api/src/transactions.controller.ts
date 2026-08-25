import { Inject, Body, Controller, Headers, Post } from '@nestjs/common';
import { AccumulateService } from './accumulate.service';
import { RedeemService } from './redeem.service';
import { StoreAccessService } from './store-access.service';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(AccumulateService) private accumulateSvc: AccumulateService,
    @Inject(RedeemService) private redeemSvc: RedeemService,
    @Inject(StoreAccessService) private access: StoreAccessService
  ) {}

  @Post('accumulate')
  async accumulate(
    @Headers('authorization') authHeader: string | undefined,
    @Body()
    body: {
      passId: string;
      storeId: string;
      paymentAmount?: number;
      points?: number;
    }
  ) {
    await this.access.requireStore(body.storeId, authHeader);
    const result = await this.accumulateSvc.accumulate({
      storeId: body.storeId,
      passId: body.passId,
      paymentAmount: body.paymentAmount,
      points: body.points,
    });
    return {
      pass: result.pass,
      points: result.points,
      delta: result.delta,
      next: result.next,
    };
  }

  @Post('redeem')
  async redeem(
    @Headers('authorization') authHeader: string | undefined,
    @Body()
    body: {
      passId: string;
      storeId: string;
      promotionId: string;
      paymentAmount?: number;
      benefitAmount?: number;
    }
  ) {
    await this.access.requireStore(body.storeId, authHeader);
    const result = await this.redeemSvc.redeem({
      storeId: body.storeId,
      passId: body.passId,
      promotionId: body.promotionId,
      paymentAmount: body.paymentAmount,
      benefitAmount: body.benefitAmount,
    });
    return {
      pass: result.pass,
      promotion: result.promotion,
      points: result.points,
      benefitAmount: result.benefitAmount,
    };
  }
}
