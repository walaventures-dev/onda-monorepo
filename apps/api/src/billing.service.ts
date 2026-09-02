import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  BillingInvoiceKind,
  BillingInvoiceStatus,
  type Store,
} from '@prisma/client';
import {
  BILLING_ISSUER,
  PLAN_META,
  REFERRAL_BONUS_DAYS,
  WOMPI_MIN_CHARGE_COP,
  addBillingDays,
  advanceNextBillingAt,
  advanceNextUsageBillingAt,
  formatChargeDate,
  initialNextBillingAt,
  initialNextUsageBillingAt,
  parseBillingPeriod,
  parsePlanId,
  quotePlanWithDiscount,
  quoteUsageOverage,
  usagePeriodFor,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { WompiService } from './wompi.service';
import { JobsService } from './jobs.service';
import { MailService } from './mail.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { BillingStorageService } from './billing-storage.service';
import {
  monthlyCampaignsSent,
  monthlyNewCustomersUsed,
  monthlyReachUsed,
  usageWindow,
} from './plan-quota';
import { campaignReachPricing } from './campaign-pricing';
import {
  billingInvoiceEmailHtml,
  billingInvoiceEmailText,
} from './mail-templates/billing-invoice';

export type PaymentTokens = {
  cardToken: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  customerEmail: string;
};

const SAME_DAY_MS = 12 * 60 * 60 * 1000;

type InvoiceLine = { label: string; amountCop: number };

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WompiService) private wompi: WompiService,
    @Inject(forwardRef(() => JobsService)) private jobs: JobsService,
    @Inject(MailService) private mail: MailService,
    @Inject(InvoicePdfService) private pdfs: InvoicePdfService,
    @Inject(BillingStorageService) private storage: BillingStorageService
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

  async scheduleUsageAt(storeId: string, nextUsageBillingAt: Date) {
    const delayMs = Math.max(0, nextUsageBillingAt.getTime() - Date.now());
    return this.jobs.enqueue('usage-billing', { storeId }, { delayMs });
  }

  private async startUsageCycle(storeId: string, from = new Date()) {
    const nextUsageBillingAt = initialNextUsageBillingAt(from);
    await this.prisma.store.update({
      where: { id: storeId },
      data: { nextUsageBillingAt },
    });
    await this.scheduleUsageAt(storeId, nextUsageBillingAt);
    return nextUsageBillingAt;
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
    const nextUsageBillingAt = initialNextUsageBillingAt(now);
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
        nextUsageBillingAt,
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
    if (finalStore.nextUsageBillingAt) {
      await this.scheduleUsageAt(store.id, finalStore.nextUsageBillingAt);
    }

    await this.issueActivationInvoice({
      store: finalStore,
      planCop: 0,
      reference,
      periodStart: now,
      periodEnd: nextBillingAt,
    });

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
    const nextUsageBillingAt = initialNextUsageBillingAt(now);

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        planType: input.planType,
        billingPeriod: input.billingPeriod,
        billingStatus: 'ACTIVE',
        wompiPaymentSourceId: paymentSourceId,
        wompiTransactionId: reference,
        nextBillingAt,
        nextUsageBillingAt,
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
    if (finalStore.nextUsageBillingAt) {
      await this.scheduleUsageAt(store.id, finalStore.nextUsageBillingAt);
    }

    await this.issueActivationInvoice({
      store: finalStore,
      planCop: amountCop,
      reference,
      periodStart: now,
      periodEnd: nextBillingAt,
    });

    return {
      store: finalStore,
      amountCop,
      quote,
      reference,
      stub: !this.wompi.isConfigured,
    };
  }

  async renewStore(storeId: string) {
    return this.runDueBilling(storeId, 'plan');
  }

  async runUsageBilling(storeId: string) {
    return this.runDueBilling(storeId, 'usage');
  }

  async sweepDueBilling() {
    const now = new Date();
    const grace = new Date(now.getTime() + 60_000);
    const stores = await this.prisma.store.findMany({
      where: {
        OR: [
          { nextBillingAt: { lte: grace } },
          { nextUsageBillingAt: { lte: grace } },
          { nextUsageBillingAt: null, billingStatus: 'ACTIVE' },
        ],
      },
      select: { id: true, nextUsageBillingAt: true, billingStatus: true },
    });
    let ran = 0;
    for (const s of stores) {
      if (!s.nextUsageBillingAt) {
        await this.startUsageCycle(s.id, now);
        continue;
      }
      try {
        await this.runDueBilling(s.id, 'sweep');
        ran += 1;
      } catch (e) {
        this.logger.error(
          `sweep store=${s.id}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
    this.logger.log(`billing-sweep stores=${stores.length} ran=${ran}`);
    return { stores: stores.length, ran };
  }

  async runDueBilling(storeId: string, trigger: 'plan' | 'usage' | 'sweep') {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      this.logger.log(`[billing] store no encontrado ${storeId}`);
      return;
    }

    const now = new Date();
    if (!store.nextUsageBillingAt) {
      await this.startUsageCycle(store.id, now);
    }
    const fresh = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });

    const planDue = Boolean(
      fresh.nextBillingAt && fresh.nextBillingAt.getTime() <= now.getTime() + 60_000
    );
    const usageDue = Boolean(
      fresh.nextUsageBillingAt &&
        fresh.nextUsageBillingAt.getTime() <= now.getTime() + 60_000
    );

    const planSoon = Boolean(
      fresh.nextBillingAt &&
        Math.abs(fresh.nextBillingAt.getTime() - now.getTime()) <= SAME_DAY_MS
    );
    const usageSoon = Boolean(
      fresh.nextUsageBillingAt &&
        Math.abs(fresh.nextUsageBillingAt.getTime() - now.getTime()) <= SAME_DAY_MS
    );

    const doPlan =
      planDue || (trigger === 'usage' && usageDue && planSoon);
    const doUsage =
      usageDue || (trigger === 'plan' && planDue && usageSoon);

    if (!doPlan && !doUsage) {
      if (trigger === 'plan' && fresh.nextBillingAt) {
        await this.scheduleRenewAt(fresh.id, fresh.nextBillingAt);
      }
      if (trigger === 'usage' && fresh.nextUsageBillingAt) {
        await this.scheduleUsageAt(fresh.id, fresh.nextUsageBillingAt);
      }
      return;
    }

    await this.closeAndInvoice(fresh, { plan: doPlan, usage: doUsage }, now);
  }

  private async closeAndInvoice(
    store: Store,
    flags: { plan: boolean; usage: boolean },
    now: Date
  ) {
    const planType = this.normalizePlan(store.planType);
    const billingPeriod = this.normalizePeriod(store.billingPeriod);
    const kind: BillingInvoiceKind =
      flags.plan && flags.usage
        ? BillingInvoiceKind.COMBINED
        : flags.plan
          ? BillingInvoiceKind.PLAN
          : BillingInvoiceKind.USAGE;

    const usageEnd = store.nextUsageBillingAt || now;
    const usageStart = usagePeriodFor(usageEnd).start;
    const planEnd = store.nextBillingAt || now;
    const periodStart = flags.usage ? usageStart : addBillingDays(planEnd, -30);
    const periodEnd = flags.usage && flags.plan
      ? new Date(Math.max(usageEnd.getTime(), planEnd.getTime()))
      : flags.usage
        ? usageEnd
        : planEnd;

    const existing = await this.prisma.billingInvoice.findFirst({
      where: {
        storeId: store.id,
        kind,
        periodStart,
        periodEnd,
      },
    });
    if (existing) {
      this.logger.log(`invoice ya existe ${existing.invoiceNumber}`);
      await this.advanceCuts(store, flags, now);
      return;
    }

    let planCop = 0;
    if (flags.plan) {
      planCop = quotePlanWithDiscount(planType, billingPeriod, 0).amountDue;
    }

    let usageSnap = {
      newCustomersUsed: 0,
      smsUsed: 0,
      campaignsCount: 0,
      extraCustomers: 0,
      extraSms: 0,
      extraCustomersCop: 0,
      extraSmsCop: 0,
      extrasCop: 0,
      carriedInCop: store.usageBalanceCop,
      subtotal: store.usageBalanceCop,
      unitCustomerCop: 500,
      unitSmsCop: 150,
      newCustomersLimit: quoteUsageOverage({
        plan: planType,
        newCustomersUsed: 0,
        smsUsed: 0,
      }).newCustomersLimit,
      smsLimit: quoteUsageOverage({
        plan: planType,
        newCustomersUsed: 0,
        smsUsed: 0,
      }).smsLimit,
    };
    if (flags.usage) {
      const [newCustomersUsed, smsUsed, campaignsCount] = await Promise.all([
        monthlyNewCustomersUsed(this.prisma, store.id, usageStart, usageEnd),
        monthlyReachUsed(this.prisma, store.id, usageStart, usageEnd),
        monthlyCampaignsSent(this.prisma, store.id, usageStart, usageEnd),
      ]);
      usageSnap = {
        ...quoteUsageOverage({
          plan: planType,
          newCustomersUsed,
          smsUsed,
          carriedInCop: store.usageBalanceCop,
        }),
        newCustomersUsed,
        smsUsed,
        campaignsCount,
      };
    }

    const lines: InvoiceLine[] = [];
    if (flags.plan) {
      lines.push({
        label: `${PLAN_META[planType].name} (${billingPeriod === 'monthly' ? 'mensual' : billingPeriod === '6' ? '6 meses' : '12 meses'})`,
        amountCop: planCop,
      });
    }
    if (flags.usage) {
      if (usageSnap.extraCustomers > 0) {
        lines.push({
          label: `Clientes nuevos extra (${usageSnap.extraCustomers} × ${formatCopSafe(usageSnap.unitCustomerCop)})`,
          amountCop: usageSnap.extraCustomersCop,
        });
      }
      if (usageSnap.extraSms > 0) {
        lines.push({
          label: `SMS extra (${usageSnap.extraSms} × ${formatCopSafe(usageSnap.unitSmsCop)})`,
          amountCop: usageSnap.extraSmsCop,
        });
      }
      if (usageSnap.carriedInCop > 0) {
        lines.push({
          label: 'Saldo periodo anterior',
          amountCop: usageSnap.carriedInCop,
        });
      }
      if (lines.length === (flags.plan ? 1 : 0)) {
        lines.push({ label: 'Consumos adicionales', amountCop: 0 });
      }
    }

    const totalCop = planCop + (flags.usage ? usageSnap.subtotal : 0);
    let chargedCop = 0;
    let carriedOutCop = 0;
    let status: BillingInvoiceStatus = BillingInvoiceStatus.ISSUED;
    let wompiReference: string | null = null;

    const chargeable = totalCop;
    if (chargeable === 0) {
      status = BillingInvoiceStatus.ZERO;
    } else if (chargeable < WOMPI_MIN_CHARGE_COP && !flags.plan) {
      carriedOutCop = chargeable;
      status = BillingInvoiceStatus.CARRIED;
    } else if (!store.wompiPaymentSourceId && this.wompi.isConfigured) {
      status = BillingInvoiceStatus.FAILED;
      carriedOutCop = flags.usage ? usageSnap.subtotal : 0;
    } else {
      wompiReference = `onda-inv-${store.id}-${Date.now()}`;
      try {
        if (store.wompiPaymentSourceId) {
          await this.wompi.chargePaymentSource({
            paymentSourceId: store.wompiPaymentSourceId,
            storeId: store.id,
            amountInCents: chargeable * 100,
            reference: wompiReference,
            customerEmail: store.ownerEmail || undefined,
          });
        }
        chargedCop = chargeable;
        status = BillingInvoiceStatus.PAID;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`[billing] cargo falló store=${store.id}: ${msg}`);
        status = BillingInvoiceStatus.FAILED;
        carriedOutCop = flags.usage ? usageSnap.subtotal : 0;
        if (flags.plan) {
          await this.prisma.store.update({
            where: { id: store.id },
            data: { billingStatus: 'PAST_DUE' },
          });
        }
      }
    }

    const invoiceNumber = await this.nextInvoiceNumber();
    const issuedAt = now;
    const pdfBuffer = await this.pdfs.render({
      invoiceNumber,
      storeName: store.name,
      storeEmail: store.ownerEmail,
      kind,
      status,
      periodStart,
      periodEnd,
      planType,
      nextBillingAt: flags.plan
        ? advanceNextBillingAt(
            billingPeriod,
            store.nextBillingAt && store.nextBillingAt <= now
              ? store.nextBillingAt
              : now
          )
        : store.nextBillingAt,
      nextUsageBillingAt: flags.usage
        ? advanceNextUsageBillingAt(usageEnd <= now ? usageEnd : now)
        : store.nextUsageBillingAt,
      lines,
      totalCop,
      chargedCop,
      carriedOutCop,
      issuedAt,
    });
    const pdfPath = this.storage.objectPath(store.id, issuedAt, invoiceNumber);
    await this.storage.savePdf(pdfPath, pdfBuffer);

    const invoice = await this.prisma.billingInvoice.create({
      data: {
        storeId: store.id,
        kind,
        status,
        invoiceNumber,
        periodStart,
        periodEnd,
        planType,
        billingPeriod,
        planCop,
        newCustomersUsed: usageSnap.newCustomersUsed,
        newCustomersLimit: usageSnap.newCustomersLimit,
        extraCustomersCount: usageSnap.extraCustomers,
        extraCustomersCop: usageSnap.extraCustomersCop,
        smsUsed: usageSnap.smsUsed,
        smsLimit: usageSnap.smsLimit,
        extraSmsCount: usageSnap.extraSms,
        extraSmsCop: usageSnap.extraSmsCop,
        campaignsCount: usageSnap.campaignsCount,
        carriedInCop: usageSnap.carriedInCop,
        carriedOutCop,
        totalCop,
        chargedCop,
        wompiReference,
        pdfStoragePath: pdfPath,
        lineItems: lines,
        issuedAt,
        paidAt: status === BillingInvoiceStatus.PAID ? now : null,
      },
    });

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        usageBalanceCop: carriedOutCop,
        ...(status === BillingInvoiceStatus.PAID || status === BillingInvoiceStatus.ZERO
          ? { billingStatus: 'ACTIVE' }
          : {}),
      },
    });

    await this.advanceCuts(store, flags, now);
    await this.emailInvoice(store, invoice, lines, pdfBuffer);
    return invoice;
  }

  private async advanceCuts(
    store: Store,
    flags: { plan: boolean; usage: boolean },
    now: Date
  ) {
    const billingPeriod = this.normalizePeriod(store.billingPeriod);
    const data: {
      nextBillingAt?: Date;
      nextUsageBillingAt?: Date;
    } = {};
    if (flags.plan) {
      const base =
        store.nextBillingAt && store.nextBillingAt <= now
          ? store.nextBillingAt
          : now;
      data.nextBillingAt = advanceNextBillingAt(billingPeriod, base);
    }
    if (flags.usage) {
      const base =
        store.nextUsageBillingAt && store.nextUsageBillingAt <= now
          ? store.nextUsageBillingAt
          : now;
      data.nextUsageBillingAt = advanceNextUsageBillingAt(base);
    }
    if (Object.keys(data).length) {
      await this.prisma.store.update({ where: { id: store.id }, data });
    }
    const updated = await this.prisma.store.findUniqueOrThrow({
      where: { id: store.id },
    });
    if (updated.nextBillingAt) {
      await this.scheduleRenewAt(updated.id, updated.nextBillingAt);
    }
    if (updated.nextUsageBillingAt) {
      await this.scheduleUsageAt(updated.id, updated.nextUsageBillingAt);
    }
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WV-${year}-`;
    for (let i = 0; i < 5; i++) {
      const count = await this.prisma.billingInvoice.count({
        where: { invoiceNumber: { startsWith: prefix } },
      });
      const candidate = `${prefix}${String(count + 1 + i).padStart(6, '0')}`;
      const clash = await this.prisma.billingInvoice.findUnique({
        where: { invoiceNumber: candidate },
      });
      if (!clash) return candidate;
    }
    return `${prefix}${Date.now()}`;
  }

  private async issueActivationInvoice(input: {
    store: Store;
    planCop: number;
    reference: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const planType = this.normalizePlan(input.store.planType);
    const billingPeriod = this.normalizePeriod(input.store.billingPeriod);
    const lines: InvoiceLine[] = [
      {
        label: `${PLAN_META[planType].name} (${
          billingPeriod === 'monthly'
            ? 'mensual'
            : billingPeriod === '6'
              ? '6 meses'
              : '12 meses'
        })`,
        amountCop: input.planCop,
      },
    ];
    const invoiceNumber = await this.nextInvoiceNumber();
    const issuedAt = input.periodStart;
    const pdfBuffer = await this.pdfs.render({
      invoiceNumber,
      storeName: input.store.name,
      storeEmail: input.store.ownerEmail,
      kind: 'PLAN',
      status: input.planCop === 0 ? 'ZERO' : 'PAID',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      planType,
      nextBillingAt: input.store.nextBillingAt,
      nextUsageBillingAt: input.store.nextUsageBillingAt,
      lines,
      totalCop: input.planCop,
      chargedCop: input.planCop,
      carriedOutCop: 0,
      issuedAt,
    });
    const pdfPath = this.storage.objectPath(
      input.store.id,
      issuedAt,
      invoiceNumber
    );
    await this.storage.savePdf(pdfPath, pdfBuffer);
    const invoice = await this.prisma.billingInvoice.create({
      data: {
        storeId: input.store.id,
        kind: BillingInvoiceKind.PLAN,
        status:
          input.planCop === 0
            ? BillingInvoiceStatus.ZERO
            : BillingInvoiceStatus.PAID,
        invoiceNumber,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        planType,
        billingPeriod,
        planCop: input.planCop,
        totalCop: input.planCop,
        chargedCop: input.planCop,
        wompiReference: input.reference,
        pdfStoragePath: pdfPath,
        lineItems: lines,
        issuedAt,
        paidAt: issuedAt,
      },
    });
    await this.emailInvoice(input.store, invoice, lines, pdfBuffer);
  }

  private async emailInvoice(
    store: Store,
    invoice: {
      invoiceNumber: string;
      kind: BillingInvoiceKind;
      periodStart: Date;
      periodEnd: Date;
      totalCop: number;
      planType: string;
    },
    lines: InvoiceLine[],
    pdf: Buffer
  ) {
    const to = store.ownerEmail;
    if (!to) {
      this.logger.warn(`Sin email para recibo store=${store.id}`);
      return;
    }
    const kindLabel =
      invoice.kind === 'PLAN'
        ? 'Suscripción'
        : invoice.kind === 'USAGE'
          ? 'Consumos adicionales'
          : 'Suscripción y consumos';
    const periodLabel = `${formatChargeDate(invoice.periodStart)} – ${formatChargeDate(invoice.periodEnd)}`;
    const planName =
      PLAN_META[this.normalizePlan(invoice.planType)].name;
    const logoUrl = await this.storage.ensureWordmarkUrl();
    try {
      await this.mail.send({
        to: { email: to, name: store.ownerName },
        subject: `Recibo ${invoice.invoiceNumber} · ${formatCopSafe(invoice.totalCop)}`,
        html: billingInvoiceEmailHtml({
          storeName: store.name,
          ownerName: store.ownerName,
          invoiceNumber: invoice.invoiceNumber,
          kindLabel,
          periodLabel,
          totalCop: invoice.totalCop,
          planName,
          lines,
          nextPlanAt: store.nextBillingAt,
          nextUsageAt: store.nextUsageBillingAt,
          logoUrl,
        }),
        text: billingInvoiceEmailText({
          storeName: store.name,
          invoiceNumber: invoice.invoiceNumber,
          periodLabel,
          totalCop: invoice.totalCop,
          planName,
        }),
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdf,
            mimeType: 'application/pdf',
          },
        ],
      });
      await this.prisma.billingInvoice.update({
        where: { invoiceNumber: invoice.invoiceNumber },
        data: { emailedAt: new Date() },
      });
    } catch (e) {
      this.logger.error(
        `email recibo ${invoice.invoiceNumber}: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  async summary(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        id: true,
        planType: true,
        billingStatus: true,
        billingPeriod: true,
        nextBillingAt: true,
        nextUsageBillingAt: true,
        usageBalanceCop: true,
        wompiPaymentSourceId: true,
        freeMonthsBalance: true,
      },
    });
    const planType = this.normalizePlan(store.planType);
    const billingPeriod = this.normalizePeriod(store.billingPeriod);
    const pricing = campaignReachPricing({ planType });
    const window = usageWindow(store.nextUsageBillingAt);
    const [newCustomersUsed, smsUsed, campaignsCount] = await Promise.all([
      monthlyNewCustomersUsed(
        this.prisma,
        storeId,
        window.start,
        window.end
      ),
      monthlyReachUsed(this.prisma, storeId, window.start, window.end),
      monthlyCampaignsSent(this.prisma, storeId, window.start, window.end),
    ]);
    const overage = quoteUsageOverage({
      plan: planType,
      newCustomersUsed,
      smsUsed,
      carriedInCop: store.usageBalanceCop,
    });
    const planQuote = quotePlanWithDiscount(planType, billingPeriod, 0);
    return {
      planType,
      billingStatus: store.billingStatus,
      billingPeriod,
      nextBillingAt: store.nextBillingAt,
      nextUsageBillingAt: store.nextUsageBillingAt,
      usagePeriodStart: window.start,
      usagePeriodEnd: window.end,
      newCustomersUsed,
      newCustomersLimit: overage.newCustomersLimit,
      extraCustomers: overage.extraCustomers,
      extraCustomersCop: overage.extraCustomersCop,
      smsUsed,
      smsLimit: overage.smsLimit,
      extraSms: overage.extraSms,
      extraSmsCop: overage.extraSmsCop,
      campaignsCount,
      usageProjectedCop: overage.subtotal,
      carriedBalanceCop: store.usageBalanceCop,
      planPriceCop: planQuote.monthlyList,
      reachUsed: smsUsed,
      reachLimit: overage.smsLimit,
      reachUnitCop: overage.unitSmsCop,
      smsCampaignsUsed: smsUsed,
      smsCampaignsLimit: overage.smsLimit,
      campaignCredits: 0,
      packSubscribed: false,
      hasPaymentMethod:
        Boolean(store.wompiPaymentSourceId) || !this.wompi.isConfigured,
      campaignPricing: pricing,
      freeMonthsBalance: store.freeMonthsBalance,
      wompiPublicKey: this.wompi.publicKey,
      issuer: BILLING_ISSUER,
      features: {
        gpsProximity: planType === 'PRO',
        npsSurveys: planType === 'PRO',
        reviewGating: planType === 'PRO',
        dissatisfactionAlerts: planType === 'PRO',
        physicalKit: planType === 'PRO',
      },
    };
  }

  async listInvoices(storeId: string, from?: Date, to?: Date) {
    return this.prisma.billingInvoice.findMany({
      where: {
        storeId,
        ...(from || to
          ? {
              issuedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async usageBreakdown(storeId: string, from: Date, to: Date) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { planType: true },
    });
    const planType = this.normalizePlan(store.planType);
    const [newCustomersUsed, smsUsed, campaigns] = await Promise.all([
      monthlyNewCustomersUsed(this.prisma, storeId, from, to),
      monthlyReachUsed(this.prisma, storeId, from, to),
      this.prisma.campaign.findMany({
        where: {
          storeId,
          status: 'SENT',
          sentAt: { gte: from, lt: to },
        },
        select: {
          id: true,
          title: true,
          sentAt: true,
          sendSms: true,
          reachCount: true,
          smsReachCount: true,
          costCop: true,
          paidReachCount: true,
        },
        orderBy: { sentAt: 'desc' },
      }),
    ]);
    const overage = quoteUsageOverage({
      plan: planType,
      newCustomersUsed,
      smsUsed,
    });
    return {
      from,
      to,
      planType,
      newCustomersUsed,
      newCustomersLimit: overage.newCustomersLimit,
      extraCustomers: overage.extraCustomers,
      extraCustomersCop: overage.extraCustomersCop,
      smsUsed,
      smsLimit: overage.smsLimit,
      extraSms: overage.extraSms,
      extraSmsCop: overage.extraSmsCop,
      projectedCop: overage.extrasCop,
      campaigns,
    };
  }

  async getInvoicePdf(storeId: string, invoiceId: string) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, storeId },
    });
    if (!invoice) throw new NotFoundException('Recibo no encontrado');
    if (!invoice.pdfStoragePath) {
      throw new NotFoundException('El recibo no tiene documento');
    }
    const buffer = await this.storage.readPdf(invoice.pdfStoragePath);
    const signedUrl = await this.storage.signedReadUrl(invoice.pdfStoragePath);
    return {
      invoice,
      buffer,
      signedUrl,
      filename: `${invoice.invoiceNumber}.pdf`,
    };
  }
}

function formatCopSafe(n: number) {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}
