import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  CampaignBillingKind,
  CampaignObjective,
  CampaignOrigin,
  CampaignPurchaseSku,
  CampaignStatus,
  Prisma,
} from '@prisma/client';
import { StoreSubcategory } from '@onda/shared-types';
import {
  buildCampaignMessages,
  defaultPromo,
  objectiveLabel,
  renderCampaignTemplate,
  voiceFor,
  type CampaignPromo,
  type ObjectiveKind,
} from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import { WalletService } from './wallet.service';
import { BrevoService } from './brevo.service';
import { WompiService } from './wompi.service';
import {
  consumeCampaignSlot,
  monthlySmsCampaignsUsed,
} from './plan-quota';
import { campaignPricing } from './campaign-pricing';

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const DOW_LABELS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export type AudienceFilter = {
  objective: ObjectiveKind;
  slowWindow?: string;
  cartillaId?: string | null;
};

type PassRow = Prisma.PassGetPayload<{
  include: {
    user: true;
    promoAssignments: { include: { promotion: true } };
    transactions: true;
  };
}>;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(forwardRef(() => JobsService)) private jobs: JobsService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(BrevoService) private brevo: BrevoService,
    @Inject(WompiService) private wompi: WompiService
  ) {}

  async list(storeId: string) {
    const pricing = campaignPricing();
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        campaignCredits: true,
        campaignPackSubscribed: true,
        wompiPaymentSourceId: true,
      },
    });
    const [campaigns, smsUsed] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      monthlySmsCampaignsUsed(this.prisma, storeId),
    ]);
    return {
      campaigns,
      smsCampaignsUsed: smsUsed,
      smsCampaignsLimit: pricing.freeMonthly,
      freeRemaining: Math.max(0, pricing.freeMonthly - smsUsed),
      campaignCredits: store.campaignCredits,
      packSubscribed: store.campaignPackSubscribed,
      hasPaymentMethod: Boolean(store.wompiPaymentSourceId) || !this.wompi.isConfigured,
      pricing,
    };
  }

  async audience(storeId: string, objective: ObjectiveKind, cartillaId?: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const voice = voiceFor(store.subcategory as StoreSubcategory);
    const slow = await this.slowWindowForStore(storeId, voice.slowWindow);
    const members = await this.resolveMembers(storeId, {
      objective,
      slowWindow: slow.label,
      cartillaId,
    });
    const withWallet = members.filter((m) => m.walletRef).length;
    const avgDays =
      members.length === 0
        ? 0
        : Math.round(
            members.reduce((s, m) => s + m.daysSince, 0) / members.length
          );
    const near = members.filter((m) => m.nearGap != null && m.nearGap <= 2).length;
    const visitFrequency = [
      { bucket: '1–2', count: members.filter((m) => m.visits <= 2).length },
      { bucket: '3–5', count: members.filter((m) => m.visits >= 3 && m.visits <= 5).length },
      { bucket: '6+', count: members.filter((m) => m.visits >= 6).length },
    ];
    const people = members.slice(0, 8).map((m) => ({
      passId: m.passId,
      name: m.name,
      initials: initials(m.name),
      meta: m.meta,
    }));
    const chips = chipsFor(objective, slow.label);
    const headline = headlineFor(objective, members.length, voice, slow.label);
    const kpis =
      objective === 'new_reward'
        ? [
            { label: 'Alcanzables', value: String(members.length) },
            {
              label: 'Cerca del premio',
              value: members.length
                ? `${Math.round((near / members.length) * 100)}%`
                : '0%',
            },
            {
              label: 'Con Wallet',
              value: members.length
                ? `${Math.round((withWallet / members.length) * 100)}%`
                : '0%',
            },
          ]
        : [
            { label: 'Alcanzables', value: String(members.length) },
            { label: 'Días sin visita', value: String(avgDays) },
            {
              label: 'Con Wallet',
              value: members.length
                ? `${Math.round((withWallet / members.length) * 100)}%`
                : '0%',
            },
          ];
    return {
      objective,
      headline,
      chips,
      kpis,
      people,
      visitFrequency,
      count: members.length,
      slowWindow: slow.label,
      filter: {
        objective,
        slowWindow: slow.label,
        cartillaId: cartillaId || null,
      } satisfies AudienceFilter,
    };
  }

  async recommendations(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const voice = voiceFor(store.subcategory as StoreSubcategory);
    const slow = await this.slowWindowForStore(storeId, voice.slowWindow);
    const cartillas = await this.prisma.cartilla.findMany({
      where: { storeId, status: 'ACTIVE' },
      include: {
        items: {
          include: { promotion: true },
          orderBy: { pointsRequired: 'asc' },
        },
      },
    });
    const recs: Array<{
      id: string;
      objective: ObjectiveKind;
      origin: 'RECOMMENDED';
      reason: string;
      title: string;
      audienceCount: number;
      promo: CampaignPromo;
      messages: ReturnType<typeof buildCampaignMessages>;
      slowWindow?: string;
      cartillaId?: string;
    }> = [];

    const reactivate = await this.audience(storeId, 'reactivate');
    if (reactivate.count >= 1) {
      const promo = defaultPromo('reactivate', voice);
      recs.push({
        id: 'reactivate',
        objective: 'reactivate',
        origin: 'RECOMMENDED',
        reason: `${reactivate.count} clientes en riesgo o dormidos (más de 21 días sin visita).`,
        title: objectiveLabel('reactivate', voice),
        audienceCount: reactivate.count,
        promo,
        messages: buildCampaignMessages({
          promo,
          kind: 'reactivate',
          voice,
          storeName: store.name,
        }),
      });
    }

    if (slow.recommend) {
      const audience = await this.audience(storeId, 'slow_hours');
      if (audience.count >= 1) {
        const promo = {
          ...defaultPromo('slow_hours', { ...voice, slowWindow: slow.label }),
          title: `Promo ${slow.label}`,
        };
        recs.push({
          id: 'slow_hours',
          objective: 'slow_hours',
          origin: 'RECOMMENDED',
          reason: `El local está más flojo ${slow.label}.`,
          title: objectiveLabel('slow_hours', voice, slow.label),
          audienceCount: audience.count,
          promo,
          messages: buildCampaignMessages({
            promo,
            kind: 'slow_hours',
            voice,
            storeName: store.name,
            slowWindow: slow.label,
          }),
          slowWindow: slow.label,
        });
      }
    }

    const rewardCartilla = cartillas.find((c) =>
      c.items.some((i) => i.promotion.isActive)
    );
    const rewardItem = rewardCartilla?.items.find((i) => i.promotion.isActive);
    const nearAudience = await this.audience(
      storeId,
      'new_reward',
      rewardCartilla?.id
    );
    const recentPromo = rewardItem
      ? Date.now() - rewardItem.promotion.createdAt.getTime() < 14 * DAY_MS
      : false;
    if (rewardItem && (nearAudience.count >= 1 || recentPromo)) {
      const promo: CampaignPromo = {
        type: rewardItem.promotion.type as CampaignPromo['type'],
        title: rewardItem.promotion.title,
        value:
          rewardItem.promotion.value != null
            ? String(rewardItem.promotion.value)
            : '',
        buyQuantity: String(rewardItem.promotion.buyQuantity ?? 2),
        getQuantity: String(rewardItem.promotion.getQuantity ?? 1),
        productName: rewardItem.promotion.productName || rewardItem.promotion.title,
        cartillaId: rewardCartilla?.id,
        promotionId: rewardItem.promotion.id,
      };
      recs.push({
        id: 'new_reward',
        objective: 'new_reward',
        origin: 'RECOMMENDED',
        reason: recentPromo
          ? `Hay una recompensa reciente en «${rewardCartilla?.name}».`
          : `${nearAudience.count} clientes están cerca de canjear.`,
        title: `Avisar la recompensa «${rewardItem.promotion.title}»`,
        audienceCount: nearAudience.count,
        promo,
        messages: buildCampaignMessages({
          promo,
          kind: 'new_reward',
          voice,
          storeName: store.name,
        }),
        cartillaId: rewardCartilla?.id,
      });
    }

    if (store.googlePlaceId) {
      const reviews = await this.audience(storeId, 'reviews');
      if (reviews.count >= 1) {
        const promo = defaultPromo('reviews', voice);
        recs.push({
          id: 'reviews',
          objective: 'reviews',
          origin: 'RECOMMENDED',
          reason: `${reviews.count} clientes canjearon hace poco y aún no dejaron reseña.`,
          title: objectiveLabel('reviews', voice),
          audienceCount: reviews.count,
          promo,
          messages: buildCampaignMessages({
            promo,
            kind: 'reviews',
            voice,
            storeName: store.name,
          }),
        });
      }
    }

    const ending = cartillas.find((c) => {
      if (c.isDefault || !c.endsAt) return false;
      const days = (c.endsAt.getTime() - Date.now()) / DAY_MS;
      return days > 0 && days <= 10;
    });
    if (ending && !recs.some((r) => r.id === 'reactivate')) {
      const promo = defaultPromo('reactivate', voice);
      const audience = await this.audience(storeId, 'reactivate');
      recs.unshift({
        id: 'cartilla-ending',
        objective: 'reactivate',
        origin: 'RECOMMENDED',
        reason: `La cartilla «${ending.name}» cierra pronto. Conviene avisar a quienes no han vuelto.`,
        title: `Aprovechar ${ending.name} antes de que cierre`,
        audienceCount: audience.count,
        promo,
        messages: buildCampaignMessages({
          promo,
          kind: 'reactivate',
          voice,
          storeName: store.name,
        }),
        cartillaId: ending.id,
      });
    }

    return { recommendations: recs };
  }

  async create(body: {
    storeId: string;
    title?: string;
    objective?: string;
    origin?: string;
    scheduledAt?: string | null;
    smsBody?: string;
    walletBody?: string;
    sendSms?: boolean;
    sendWallet?: boolean;
    promoSnapshot?: CampaignPromo | null;
    audienceFilter?: AudienceFilter | null;
  }) {
    const storeId = body.storeId;
    if (!storeId) throw new BadRequestException('storeId es obligatorio');
    const sendSms = body.sendSms !== false;
    const sendWallet = body.sendWallet !== false;
    if (!sendSms && !sendWallet) {
      throw new BadRequestException('Elige SMS, Wallet o ambos');
    }

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : new Date();
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Fecha de lanzamiento inválida');
    }
    const delayMs = scheduledAt.getTime() - Date.now();
    if (delayMs > MS_30_DAYS) {
      throw new BadRequestException(
        'La programación máxima es de 30 días (límite de la cola de envíos).'
      );
    }

    const objective = parseObjective(body.objective);
    const origin =
      body.origin === 'RECOMMENDED'
        ? CampaignOrigin.RECOMMENDED
        : CampaignOrigin.MANUAL;
    const title = (body.title || '').trim() || defaultTitle(objective);
    const smsBody = (body.smsBody || title).trim();
    const walletBody = (body.walletBody || title).trim();
    const channel = sendSms ? 'SMS' : 'WALLET';

    const campaign = await this.prisma.$transaction(async (tx) => {
      const slot = await consumeCampaignSlot(tx, storeId);
      const billingKind =
        slot === 'CREDIT'
          ? CampaignBillingKind.CREDIT
          : CampaignBillingKind.FREE;
      return tx.campaign.create({
        data: {
          storeId,
          channel,
          title,
          status: CampaignStatus.SCHEDULED,
          origin,
          objective,
          scheduledAt,
          smsBody,
          walletBody,
          sendSms,
          sendWallet,
          billingKind,
          audienceFilter: (body.audienceFilter ?? {
            objective: objectiveToKind(objective),
          }) as Prisma.InputJsonValue,
          promoSnapshot: body.promoSnapshot
            ? (body.promoSnapshot as Prisma.InputJsonValue)
            : undefined,
        },
      });
    });

    await this.jobs.enqueue(
      'campaign-dispatch',
      { campaignId: campaign.id },
      { delayMs: Math.max(0, delayMs) }
    );
    return campaign;
  }

  async cancel(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException('Solo se pueden cancelar campañas programadas');
    }
    await this.prisma.$transaction(async (tx) => {
      if (campaign.billingKind === CampaignBillingKind.CREDIT) {
        await tx.store.update({
          where: { id: campaign.storeId },
          data: { campaignCredits: { increment: 1 } },
        });
      }
      await tx.campaign.update({
        where: { id },
        data: { status: CampaignStatus.CANCELLED },
      });
    });
    return this.prisma.campaign.findUniqueOrThrow({ where: { id } });
  }

  async purchase(
    storeId: string,
    sku: 'single' | 'pack' | 'subscribe'
  ) {
    if (!storeId) throw new BadRequestException('storeId es obligatorio');
    const pricing = campaignPricing();
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const hasCard = Boolean(store.wompiPaymentSourceId);
    if (this.wompi.isConfigured && !hasCard) {
      throw new BadRequestException({
        code: 'PAYMENT_METHOD_REQUIRED',
        message:
          'Para comprar campañas extra necesitas tu facturación y tarjeta de Wompi (la misma del onboarding). Complétalas en Configuración.',
        hasPaymentMethod: false,
        pricing,
      });
    }
    if (sku === 'subscribe' && store.campaignPackSubscribed) {
      throw new BadRequestException('Ya tienes la suscripción del paquete de campañas.');
    }

    const credits =
      sku === 'single' ? 1 : pricing.packSize;
    const amountCop = sku === 'single' ? pricing.unitCop : pricing.packCop;
    const prismaSku =
      sku === 'single'
        ? CampaignPurchaseSku.SINGLE
        : sku === 'subscribe'
          ? CampaignPurchaseSku.PACK_SUB
          : CampaignPurchaseSku.PACK;
    const reference = `onda-camp-${sku}-${storeId}-${Date.now()}`;

    if (hasCard) {
      await this.wompi.chargePaymentSource({
        paymentSourceId: store.wompiPaymentSourceId!,
        storeId,
        amountInCents: amountCop * 100,
        reference,
        customerEmail: store.ownerEmail || undefined,
      });
    } else {
      this.logger.log(`[Wompi stub] campaña ${sku} store=${storeId} ${amountCop} COP`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.campaignPurchase.create({
        data: {
          storeId,
          sku: prismaSku,
          credits,
          amountCop,
          wompiReference: reference,
        },
      });
      await tx.store.update({
        where: { id: storeId },
        data: {
          campaignCredits: { increment: credits },
          ...(sku === 'subscribe' ? { campaignPackSubscribed: true } : {}),
        },
      });
    });

    if (sku === 'subscribe') {
      await this.jobs.enqueue(
        'campaign-pack-renew',
        { storeId },
        { delayMs: MS_30_DAYS }
      );
    }

    return this.list(storeId);
  }

  async cancelPackSubscription(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    if (!store.campaignPackSubscribed) {
      throw new BadRequestException('No hay una suscripción de campañas activa.');
    }
    await this.prisma.store.update({
      where: { id: storeId },
      data: { campaignPackSubscribed: false },
    });
    return this.list(storeId);
  }

  async renewPackSubscription(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store?.campaignPackSubscribed) {
      this.logger.log(`campaign-pack-renew omitido store=${storeId}`);
      return;
    }
    if (!store.wompiPaymentSourceId && this.wompi.isConfigured) {
      this.logger.warn(`campaign-pack-renew sin tarjeta store=${storeId}`);
      return;
    }
    const pricing = campaignPricing();
    const reference = `onda-camp-sub-${storeId}-${Date.now()}`;
    if (store.wompiPaymentSourceId) {
      await this.wompi.chargePaymentSource({
        paymentSourceId: store.wompiPaymentSourceId,
        storeId,
        amountInCents: pricing.packCop * 100,
        reference,
        customerEmail: store.ownerEmail || undefined,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignPurchase.create({
        data: {
          storeId,
          sku: CampaignPurchaseSku.PACK_SUB,
          credits: pricing.packSize,
          amountCop: pricing.packCop,
          wompiReference: reference,
        },
      });
      await tx.store.update({
        where: { id: storeId },
        data: { campaignCredits: { increment: pricing.packSize } },
      });
    });
    await this.jobs.enqueue(
      'campaign-pack-renew',
      { storeId },
      { delayMs: MS_30_DAYS }
    );
  }

  async dispatch(payload: { campaignId: string }) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: payload.campaignId },
    });
    if (!campaign) {
      this.logger.warn(`campaign-dispatch: ${payload.campaignId} no existe`);
      return;
    }
    if (campaign.status !== CampaignStatus.SCHEDULED) {
      this.logger.log(
        `campaign-dispatch omitido ${campaign.id} status=${campaign.status}`
      );
      return;
    }

    const filter = (campaign.audienceFilter || {}) as AudienceFilter;
    const objective = filter.objective || objectiveToKind(campaign.objective);
    const members = await this.resolveMembers(campaign.storeId, {
      objective,
      slowWindow: filter.slowWindow,
      cartillaId: filter.cartillaId,
    });

    try {
      if (campaign.sendSms && campaign.smsBody) {
        const phones = new Map<string, string>();
        for (const m of members) {
          if (m.phone) phones.set(m.phone, m.name.split(' ')[0] || 'tú');
        }
        for (const [to, nombre] of phones) {
          const message = renderCampaignTemplate(campaign.smsBody, { nombre }).slice(
            0,
            160
          );
          await this.brevo.sendSms({ to, message });
        }
      }
      if (campaign.sendWallet && campaign.walletBody) {
        for (const m of members) {
          if (!m.walletRef) continue;
          await this.wallet.notify(
            m.walletRef,
            renderCampaignTemplate(campaign.walletBody, {
              nombre: m.name.split(' ')[0],
            })
          );
        }
      }
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.SENT, sentAt: new Date() },
      });
      this.logger.log(
        `Campaña ${campaign.id} enviada n=${members.length} sms=${campaign.sendSms} wallet=${campaign.sendWallet}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Campaña ${campaign.id} falló: ${msg}`);
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.FAILED },
      });
      throw e;
    }
  }

  private async resolveMembers(storeId: string, filter: AudienceFilter) {
    const passes = await this.prisma.pass.findMany({
      where: { storeId },
      include: {
        user: true,
        promoAssignments: { include: { promotion: true } },
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    const now = Date.now();
    const feedbackUserIds = new Set(
      (
        await this.prisma.feedback.findMany({
          where: { storeId },
          select: { userId: true },
        })
      ).map((f) => f.userId)
    );

    const mapped = passes.map((p) => this.mapPass(p, now, feedbackUserIds));
    switch (filter.objective) {
      case 'reactivate':
        return mapped.filter((m) => m.daysSince >= 21 && m.visits > 0);
      case 'slow_hours':
        return mapped.filter((m) => m.visits > 0);
      case 'new_reward':
        return mapped.filter(
          (m) => m.visits > 0 && (m.nearGap == null || m.nearGap <= 2 || m.daysSince <= 14)
        );
      case 'reviews':
        return mapped.filter((m) => m.redeemedRecently && !m.hasFeedback);
      default:
        return mapped.filter((m) => m.visits > 0);
    }
  }

  private mapPass(
    p: PassRow,
    now: number,
    feedbackUserIds: Set<string>
  ) {
    const lastTx = p.transactions[0];
    const visits = p.transactions.filter((t) => t.type === 'ACCUMULATE').length;
    const daysSince = lastTx
      ? (now - lastTx.createdAt.getTime()) / DAY_MS
      : 999;
    const rewards = (p.promoAssignments || [])
      .filter((a) => a.promotion?.isActive)
      .map((a) => ({
        pointsRequired: a.pointsRequired,
        title: a.promotion.title,
      }));
    const next = rewards
      .filter((r) => p.points < r.pointsRequired)
      .sort((a, b) => a.pointsRequired - b.pointsRequired)[0];
    const nearGap = next ? next.pointsRequired - p.points : null;
    const lastRedeem = p.transactions.find((t) => t.type === 'REDEEM');
    const redeemedRecently = Boolean(
      lastRedeem && now - lastRedeem.createdAt.getTime() <= 14 * DAY_MS
    );
    const name = p.user.name || p.user.phone;
    let meta = lastTx
      ? `hace ${Math.max(1, Math.round(daysSince))} días`
      : 'sin visitas';
    if (nearGap != null && nearGap <= 2) meta = `${p.points} ondas · cerca del premio`;
    if (redeemedRecently && lastRedeem) {
      meta = `canjeó hace ${Math.max(1, Math.round((now - lastRedeem.createdAt.getTime()) / DAY_MS))} días`;
    }
    return {
      passId: p.id,
      walletRef: p.walletRef,
      phone: p.user.phone,
      name,
      daysSince,
      visits,
      nearGap,
      redeemedRecently,
      hasFeedback: feedbackUserIds.has(p.userId),
      meta,
    };
  }

  private async slowWindowForStore(storeId: string, fallback: string) {
    const from = new Date(Date.now() - 60 * DAY_MS);
    const txs = await this.prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: from } },
      select: { createdAt: true },
    });
    if (txs.length < 8) {
      return { label: fallback, recommend: false };
    }
    const cells = Array.from({ length: 7 * 24 }, () => 0);
    for (const tx of txs) {
      const jsDay = tx.createdAt.getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1;
      cells[dow * 24 + tx.createdAt.getHours()] += 1;
    }
    let best = { score: Infinity, dow: 1, hour: 14 };
    for (let dow = 0; dow < 5; dow++) {
      for (let hour = 10; hour <= 17; hour++) {
        const score =
          cells[dow * 24 + hour] +
          cells[dow * 24 + hour + 1] +
          cells[dow * 24 + hour + 2];
        if (score < best.score) best = { score, dow, hour };
      }
    }
    const peak = Math.max(...cells, 1);
    const windowPeak = Math.max(
      cells[best.dow * 24 + best.hour],
      cells[best.dow * 24 + best.hour + 1],
      cells[best.dow * 24 + best.hour + 2],
      0
    );
    const nextDow = Math.min(best.dow + 1, 4);
    const label = `${DOW_LABELS[best.dow]} y ${DOW_LABELS[nextDow]} de ${formatHour(best.hour)} a ${formatHour(best.hour + 3)}`;
    return { label, recommend: windowPeak < peak * 0.55 };
  }
}

function formatHour(h: number) {
  const hour = ((h % 24) + 24) % 24;
  if (hour === 12) return '12 m';
  if (hour === 0) return '12 am';
  if (hour > 12) return `${hour - 12} pm`;
  return `${hour} am`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || parts[0]?.[1] || '';
  return (a + b).toUpperCase();
}

function chipsFor(kind: ObjectiveKind, slowWindow: string) {
  switch (kind) {
    case 'reactivate':
      return ['En riesgo / dormidos', 'Wallet o SMS', 'Visitaron antes'];
    case 'slow_hours':
      return ['Ya conocen el local', slowWindow, 'Invitación a horario flojo'];
    case 'new_reward':
      return ['Activos', 'Cerca del canje', 'Cartilla vigente'];
    case 'reviews':
      return ['Canje reciente', 'Sin reseña', '14 días'];
  }
}

function headlineFor(
  kind: ObjectiveKind,
  count: number,
  voice: ReturnType<typeof voiceFor>,
  slowWindow: string
) {
  if (count === 0) {
    return `Aún no hay ${voice.customerPlural} para este objetivo.`;
  }
  switch (kind) {
    case 'reactivate':
      return `Encontramos ${count} ${voice.customerPlural} que no regresan hace más de 21 días.`;
    case 'slow_hours':
      return `Encontramos ${count} ${voice.customerPlural} a quienes invitar ${slowWindow}.`;
    case 'new_reward':
      return `Encontramos ${count} ${voice.customerPlural} listos para la nueva recompensa.`;
    case 'reviews':
      return `Encontramos ${count} ${voice.customerPlural} felices que aún no dejaron reseña.`;
  }
}

function parseObjective(raw?: string): CampaignObjective | null {
  const key = (raw || '').toLowerCase();
  switch (key) {
    case 'reactivate':
      return CampaignObjective.REACTIVATE;
    case 'slow_hours':
      return CampaignObjective.SLOW_HOURS;
    case 'new_reward':
      return CampaignObjective.NEW_REWARD;
    case 'reviews':
      return CampaignObjective.REVIEWS;
    default:
      return null;
  }
}

function objectiveToKind(obj: CampaignObjective | null): ObjectiveKind {
  switch (obj) {
    case CampaignObjective.SLOW_HOURS:
      return 'slow_hours';
    case CampaignObjective.NEW_REWARD:
      return 'new_reward';
    case CampaignObjective.REVIEWS:
      return 'reviews';
    default:
      return 'reactivate';
  }
}

function defaultTitle(objective: CampaignObjective | null) {
  switch (objective) {
    case CampaignObjective.SLOW_HOURS:
      return 'Campaña horario flojo';
    case CampaignObjective.NEW_REWARD:
      return 'Campaña nueva recompensa';
    case CampaignObjective.REVIEWS:
      return 'Campaña reseñas';
    default:
      return 'Campaña de reactivación';
  }
}
