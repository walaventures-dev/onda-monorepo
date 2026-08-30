import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import {
  REFERRAL_BONUS_DAYS,
  addBillingDays,
  advanceNextBillingAt,
  initialNextBillingAt,
  parseBillingPeriod,
  parsePlanId,
  quotePlanWithDiscount,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { WompiService } from './wompi.service';
import { JobsService } from './jobs.service';

export type PaymentTokens = {
  cardToken: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  customerEmail: string;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WompiService) private wompi: WompiService,
    @Inject(forwardRef(() => JobsService)) private jobs: JobsService
  ) {}

  normalizePlan(plan?: string | null): PlanId {
    return parsePlanId(plan) || 'BASIC';
  }

  normalizePeriod(period?: string | null): BillingPeriod {
    return parseBillingPeriod(period) || 'monthly';
  }

  assertBillingAllowed(
    billingPeriod: BillingPeriod,
    discountPercentage: number
  ) {
    if (discountPercentage > 30 && billingPeriod !== 'monthly') {
      throw new BadRequestException(
        'Con descuento mayor al 30% solo puedes pagar mensual'
      );
    }
  }

  async scheduleRenewAt(storeId: string, nextBillingAt: Date) {
    const delayMs = Math.max(0, nextBillingAt.getTime() - Date.now());
    return this.jobs.enqueue('wompi-renew', { storeId }, { delayMs });
  }

  async applyReferralBonusOnPayment(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        referredByStoreId: true,
        referralBonusApplied: true,
        nextBillingAt: true,
      },
    });
    if (!store?.referredByStoreId || store.referralBonusApplied) {
      return { applied: false as const };
    }

    const now = new Date();
    const referredBase = store.nextBillingAt || now;
    const referredNext = addBillingDays(referredBase, REFERRAL_BONUS_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: store.id },
        data: {
          nextBillingAt: referredNext,
          referralBonusApplied: true,
          freeMonthsBalance: { increment: 1 },
        },
      });
      const referrer = await tx.store.findUnique({
        where: { id: store.referredByStoreId! },
        select: { id: true, nextBillingAt: true },
      });
      if (referrer) {
        const referrerBase = referrer.nextBillingAt || now;
        await tx.store.update({
          where: { id: referrer.id },
          data: {
            nextBillingAt: addBillingDays(referrerBase, REFERRAL_BONUS_DAYS),
            freeMonthsBalance: { increment: 1 },
          },
        });
      }
    });

    const referrerId = store.referredByStoreId;
    const [referred, referrer] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: store.id },
        select: { nextBillingAt: true },
      }),
      this.prisma.store.findUnique({
        where: { id: referrerId },
        select: { nextBillingAt: true },
      }),
    ]);
    if (referred?.nextBillingAt) {
      await this.scheduleRenewAt(store.id, referred.nextBillingAt);
    }
    if (referrer?.nextBillingAt) {
      await this.scheduleRenewAt(referrerId, referrer.nextBillingAt);
    }

    this.logger.log(
      `Referral bonus applied store=${storeId} referrer=${referrerId}`
    );
    return { applied: true as const };
  }

  async ensurePaymentSource(
    store: { id: string; wompiPaymentSourceId: string | null; ownerEmail: string | null },
    tokens?: PaymentTokens
  ): Promise<string> {
    if (store.wompiPaymentSourceId) {
      return store.wompiPaymentSourceId;
    }
    if (!tokens?.cardToken) {
      throw new BadRequestException('Tarjeta requerida');
    }
    if (!this.wompi.isConfigured) {
      const stubId = `stub-ps-${store.id}`;
      await this.prisma.store.update({
        where: { id: store.id },
        data: { wompiPaymentSourceId: stubId },
      });
      return stubId;
    }
    const email =
      tokens.customerEmail || store.ownerEmail || 'billing@onda.lat';
    if (!tokens.acceptanceToken || !tokens.acceptPersonalAuth) {
      throw new BadRequestException('Debes aceptar los términos de Wompi');
    }
    let source: { id: string; stub?: boolean };
    try {
      source = await this.wompi.createPaymentSource({
        token: tokens.cardToken,
        customerEmail: email,
        acceptanceToken: tokens.acceptanceToken,
        acceptPersonalAuth: tokens.acceptPersonalAuth,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Wompi payment_source store=${store.id}: ${msg}`);
      throw new BadRequestException(
        'No se pudo registrar la tarjeta. Revisa los datos o intenta con otra.'
      );
    }
    await this.prisma.store.update({
      where: { id: store.id },
      data: { wompiPaymentSourceId: source.id },
    });
    return source.id;
  }

  async chargeSubscription(input: {
    storeId: string;
    planType: PlanId;
    billingPeriod: BillingPeriod;
    paymentSourceId: string;
    customerEmail?: string | null;
    referenceKind?: string;
    discountPercentage?: number;
  }) {
    const quote = quotePlanWithDiscount(
      input.planType,
      input.billingPeriod,
      input.discountPercentage ?? 0
    );
    const reference = `onda-${input.referenceKind || 'sub'}-${input.storeId}-${Date.now()}`;
    try {
      await this.wompi.chargePaymentSource({
        paymentSourceId: input.paymentSourceId,
        storeId: input.storeId,
        amountInCents: quote.amountDue * 100,
        reference,
        customerEmail: input.customerEmail || undefined,
      });
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Wompi charge store=${input.storeId}: ${msg}`);
      throw new BadRequestException(
        'No se pudo cobrar la tarjeta. Revisa los datos o intenta con otra.'
      );
    }
    return { reference, amountCop: quote.amountDue, quote };
  }

  async activateComplimentarySubscription(input: {
    storeId: string;
    planType: PlanId;
    billingPeriod: BillingPeriod;
    promoCode?: string;
    referred?: boolean;
  }) {
    const now = new Date();
    const nextBillingAt = initialNextBillingAt(input.billingPeriod, now, {
      referred: Boolean(input.referred),
    });
    const reference = `onda-promo-${input.storeId}-${Date.now()}`;
    const quote = quotePlanWithDiscount(
      input.planType,
      input.billingPeriod,
      100
    );

    const store = await this.prisma.store.update({
      where: { id: input.storeId },
      data: {
        planType: input.planType,
        billingPeriod: input.billingPeriod,
        billingStatus: 'ACTIVE',
        wompiTransactionId: reference,
        nextBillingAt,
        promoCodeUsed: input.promoCode,
      },
    });

    if (input.referred) {
      await this.applyReferralBonusOnPayment(store.id);
    }

    const finalStore = await this.prisma.store.findUniqueOrThrow({
      where: { id: store.id },
    });
    if (finalStore.nextBillingAt) {
      await this.scheduleRenewAt(store.id, finalStore.nextBillingAt);
    }

    this.logger.log(
      `[Promo] suscripción cortesía store=${input.storeId} plan=${input.planType}`
    );

    return {
      store: finalStore,
      amountCop: 0,
      quote,
      reference,
      stub: true as const,
      complimentary: true as const,
    };
  }

  async activatePaidSubscription(input: {
    storeId: string;
    planType: PlanId;
    billingPeriod: BillingPeriod;
    tokens?: PaymentTokens;
    discountPercentage?: number;
    promoCode?: string;
    resetBillingCycle?: boolean;
  }) {
    const discountPercentage = input.discountPercentage ?? 0;
    this.assertBillingAllowed(input.billingPeriod, discountPercentage);

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: input.storeId },
      select: {
        id: true,
        ownerEmail: true,
        wompiPaymentSourceId: true,
        referredByStoreId: true,
        referralBonusApplied: true,
      },
    });

    const paymentSourceId = await this.ensurePaymentSource(store, input.tokens);
    const { reference, amountCop, quote } = await this.chargeSubscription({
      storeId: store.id,
      planType: input.planType,
      billingPeriod: input.billingPeriod,
      paymentSourceId,
      customerEmail: input.tokens?.customerEmail || store.ownerEmail,
      referenceKind: input.resetBillingCycle ? 'plan' : 'sub',
      discountPercentage,
    });

    const now = new Date();
    const nextBillingAt = initialNextBillingAt(input.billingPeriod, now, {
      referred: false,
    });

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        planType: input.planType,
        billingPeriod: input.billingPeriod,
        billingStatus: 'ACTIVE',
        wompiPaymentSourceId: paymentSourceId,
        wompiTransactionId: reference,
        nextBillingAt,
        promoCodeUsed: input.promoCode,
      },
    });

    if (store.referredByStoreId) {
      await this.applyReferralBonusOnPayment(store.id);
    }

    const finalStore = await this.prisma.store.findUniqueOrThrow({
      where: { id: store.id },
    });
    if (finalStore.nextBillingAt) {
      await this.scheduleRenewAt(store.id, finalStore.nextBillingAt);
    }

    return {
      store: finalStore,
      amountCop,
      quote,
      reference,
      stub: !this.wompi.isConfigured,
    };
  }

  async renewStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) {
      this.logger.log(`[Wompi renew] store no encontrado ${storeId}`);
      return;
    }
    if (!store.wompiPaymentSourceId) {
      this.logger.log(`[Wompi renew] sin payment source store=${storeId}`);
      return;
    }

    const now = new Date();
    if (
      store.nextBillingAt &&
      store.nextBillingAt.getTime() > now.getTime() + 60_000
    ) {
      await this.scheduleRenewAt(store.id, store.nextBillingAt);
      return;
    }

    const planType = this.normalizePlan(store.planType);
    const billingPeriod = this.normalizePeriod(store.billingPeriod);
    const quote = quotePlanWithDiscount(planType, billingPeriod, 0);

    try {
      await this.wompi.chargePaymentSource({
        paymentSourceId: store.wompiPaymentSourceId,
        storeId: store.id,
        amountInCents: quote.amountDue * 100,
        reference: `onda-renew-${store.id}-${Date.now()}`,
        customerEmail: store.ownerEmail || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Wompi renew] fallo store=${storeId}: ${msg}`);
      await this.prisma.store.update({
        where: { id: store.id },
        data: { billingStatus: 'PAST_DUE' },
      });
      throw e;
    }

    const base =
      store.nextBillingAt && store.nextBillingAt <= now
        ? store.nextBillingAt
        : now;
    const nextBillingAt = advanceNextBillingAt(billingPeriod, base);
    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        nextBillingAt,
        billingStatus: 'ACTIVE',
      },
    });
    await this.scheduleRenewAt(store.id, nextBillingAt);
  }
}
