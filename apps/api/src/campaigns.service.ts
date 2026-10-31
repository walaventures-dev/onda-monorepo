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
  CampaignStatus,
  Prisma,
} from '@prisma/client';
import { StoreSegment, StoreSubcategory } from '@onda/shared-types';
import {
  buildObjectiveMessages,
  nextRewardSuffix,
  objectiveLabel,
  renderCampaignTemplate,
  voiceFor,
  campaignWorked,
  computeRoiRatio,
  successLabel,
  successWindowDays,
  formatSlowWindowParts,
  type ObjectiveKind,
} from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { JobsService } from './jobs.service';
import { WalletService } from './wallet.service';
import { BrevoService } from './brevo.service';
import { WompiService } from './wompi.service';
import { buildFeedbackUrl } from './feedback-url';
import {
  assertCanLaunchReach,
  monthlyReachUsed,
  quoteReachCost,
  usageWindow,
} from './plan-quota';
import { campaignReachPricing } from './campaign-pricing';

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const DOW_LABELS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export type AudienceFilter = {
  objective: ObjectiveKind;
  slowWindow?: string;
  inactiveDays?: number;
  minVisits?: number;
  maxPointsGap?: number;
  activeWithinDays?: number;
  redeemWithinDays?: number;
  negativeWithinDays?: number;
  slowDows?: number[];
  slowStartHour?: number;
  slowEndHour?: number;
  requireWallet?: boolean;
  cartillaId?: string | null;
  rewardName?: string;
  reviewIncentive?: string;
  selectedPassIds?: string[];
};

type AudienceQueryOpts = Partial<
  Omit<AudienceFilter, 'objective' | 'cartillaId'>
>;

type PassRow = Prisma.PassGetPayload<{
  include: {
    user: true;
    promoAssignments: { include: { promotion: true } };
    transactions: true;
  };
}>;

type MemberRow = {
  passId: string;
  userId: string;
  walletRef: string | null;
  phone: string | null;
  name: string;
  daysSince: number;
  visits: number;
  nearGap: number | null;
  nextRewardTitle: string | null;
  redeemedRecently: boolean;
  daysSinceRedeem: number | null;
  daysSinceNegativeFeedback: number | null;
  hasFeedback: boolean;
  meta: string;
};

function memberDto(m: MemberRow) {
  return {
    passId: m.passId,
    name: m.name,
    initials: initials(m.name),
    meta: m.meta,
    phone: m.phone,
    walletRef: m.walletRef,
    daysSince: Math.round(m.daysSince),
    visits: m.visits,
    nearGap: m.nearGap,
    nextRewardTitle: m.nextRewardTitle,
  };
}

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
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { wompiPaymentSourceId: true, planType: true, nextUsageBillingAt: true },
    });
    const pricing = campaignReachPricing({ planType: store.planType });
    const window = usageWindow(store.nextUsageBillingAt);
    const [campaigns, reachUsed] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      monthlyReachUsed(this.prisma, storeId, window.start, window.end),
    ]);
    const freeRemaining = Math.max(0, pricing.freeMonthly - reachUsed);
    return {
      campaigns: campaigns.map((c) => ({
        ...c,
        groupKey: c.groupId ?? c.id,
      })),
      reachUsed,
      reachLimit: pricing.freeMonthly,
      freeRemaining,
      unitCop: pricing.unitCop,
      hasPaymentMethod: Boolean(store.wompiPaymentSourceId) || !this.wompi.isConfigured,
      pricing,
      // Legacy aliases for older clients
      smsCampaignsUsed: reachUsed,
      smsCampaignsLimit: pricing.freeMonthly,
      campaignCredits: 0,
      packSubscribed: false,
    };
  }

  async quota(storeId: string) {
    if (!storeId) throw new BadRequestException('storeId es obligatorio');
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { wompiPaymentSourceId: true, planType: true, nextUsageBillingAt: true },
    });
    const pricing = campaignReachPricing({ planType: store.planType });
    const window = usageWindow(store.nextUsageBillingAt);
    const reachUsed = await monthlyReachUsed(
      this.prisma,
      storeId,
      window.start,
      window.end
    );
    return {
      reachUsed,
      reachLimit: pricing.freeMonthly,
      freeRemaining: Math.max(0, pricing.freeMonthly - reachUsed),
      unitCop: pricing.unitCop,
      hasPaymentMethod: Boolean(store.wompiPaymentSourceId) || !this.wompi.isConfigured,
    };
  }

  async audience(
    storeId: string,
    objective: ObjectiveKind,
    cartillaId?: string,
    opts: AudienceQueryOpts = {}
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const voice = voiceFor(
      store.subcategory as StoreSubcategory,
      store.segment as StoreSegment | null
    );
    const slow = await this.slowWindowForStore(storeId, voice.slowWindow);
    const structuredSlow = formatSlowWindowParts({
      dows: opts.slowDows ?? [],
      startHour: opts.slowStartHour ?? Number.NaN,
      endHour: opts.slowEndHour ?? Number.NaN,
    });
    const slowWindow = structuredSlow || opts.slowWindow?.trim() || slow.label;
    const filter: AudienceFilter = {
      objective,
      slowWindow,
      inactiveDays: clampInt(opts.inactiveDays, 7, 180, 21),
      minVisits: clampInt(opts.minVisits, 1, 20, 1),
      maxPointsGap: clampInt(opts.maxPointsGap, 1, 10, 2),
      activeWithinDays: clampInt(opts.activeWithinDays, 1, 90, 14),
      redeemWithinDays: clampInt(opts.redeemWithinDays, 1, 60, 14),
      negativeWithinDays: clampInt(opts.negativeWithinDays, 1, 90, 30),
      slowDows: Array.isArray(opts.slowDows)
        ? [...new Set(opts.slowDows.map(Number).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b)
        : undefined,
      slowStartHour:
        opts.slowStartHour != null && Number.isFinite(opts.slowStartHour)
          ? Math.max(0, Math.min(23, Math.round(opts.slowStartHour)))
          : undefined,
      slowEndHour:
        opts.slowEndHour != null && Number.isFinite(opts.slowEndHour)
          ? Math.max(0, Math.min(23, Math.round(opts.slowEndHour)))
          : undefined,
      requireWallet: opts.requireWallet === true,
      cartillaId: cartillaId || null,
    };
    const members = await this.resolveMembers(storeId, filter);
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
    const chips = chipsFor(objective, filter);
    const headline = headlineFor(objective, members.length, voice, filter);
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
      members: members.slice(0, 300).map(memberDto),
      visitFrequency,
      count: members.length,
      slowWindow,
      filter: {
        objective: filter.objective,
        slowWindow: filter.slowWindow,
        inactiveDays: filter.inactiveDays,
        minVisits: filter.minVisits,
        maxPointsGap: filter.maxPointsGap,
        activeWithinDays: filter.activeWithinDays,
        redeemWithinDays: filter.redeemWithinDays,
        negativeWithinDays: filter.negativeWithinDays,
        slowDows: filter.slowDows,
        slowStartHour: filter.slowStartHour,
        slowEndHour: filter.slowEndHour,
        requireWallet: filter.requireWallet,
        cartillaId: filter.cartillaId,
      } satisfies AudienceFilter,
    };
  }

  async browseAudience(
    storeId: string,
    opts: {
      search?: string;
      inactiveFrom?: number;
      inactiveTo?: number;
      ondasGap?: number;
      requireWallet?: boolean;
    } = {}
  ) {
    if (!storeId) throw new BadRequestException('storeId es obligatorio');
    const { mapped } = await this.loadMappedPasses(storeId);
    let members = mapped;

    const search = opts.search?.trim().toLowerCase();
    if (search) {
      const digits = search.replace(/\D/g, '');
      members = members.filter((m) => {
        if (m.name.toLowerCase().includes(search)) return true;
        const phoneDigits = (m.phone || '').replace(/\D/g, '');
        return digits.length > 0 && phoneDigits.includes(digits);
      });
    }
    if (opts.inactiveFrom != null && Number.isFinite(opts.inactiveFrom)) {
      members = members.filter((m) => m.daysSince >= opts.inactiveFrom!);
    }
    if (opts.inactiveTo != null && Number.isFinite(opts.inactiveTo)) {
      members = members.filter((m) => m.daysSince <= opts.inactiveTo!);
    }
    if (opts.ondasGap != null && Number.isFinite(opts.ondasGap)) {
      members = members.filter(
        (m) => m.nearGap != null && m.nearGap <= opts.ondasGap!
      );
    }
    if (opts.requireWallet) {
      members = members.filter((m) => m.walletRef);
    }
    members.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return {
      count: members.length,
      members: members.slice(0, 300).map(memberDto),
    };
  }

  async recommendations(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const voice = voiceFor(
      store.subcategory as StoreSubcategory,
      store.segment as StoreSegment | null
    );
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
      messages: ReturnType<typeof buildObjectiveMessages>;
      slowWindow?: string;
      cartillaId?: string;
      rewardName?: string;
    }> = [];

    const reactivate = await this.audience(storeId, 'reactivate');
    if (reactivate.count >= 1) {
      const details = recommendedDetails(voice, { slowWindow: slow.label });
      recs.push({
        id: 'reactivate',
        objective: 'reactivate',
        origin: 'RECOMMENDED',
        reason: `${reactivate.count} clientes en riesgo o dormidos (más de 21 días sin visita).`,
        title: objectiveLabel('reactivate', voice),
        audienceCount: reactivate.count,
        messages: buildObjectiveMessages({
          kind: 'reactivate',
          voice,
          storeName: store.name,
          details,
        }),
      });
    }

    if (slow.recommend) {
      const audience = await this.audience(storeId, 'slow_hours');
      if (audience.count >= 1) {
        const details = recommendedDetails(voice, { slowWindow: slow.label });
        recs.push({
          id: 'slow_hours',
          objective: 'slow_hours',
          origin: 'RECOMMENDED',
          reason: `El local está más flojo ${slow.label}.`,
          title: objectiveLabel('slow_hours', voice, slow.label),
          audienceCount: audience.count,
          messages: buildObjectiveMessages({
            kind: 'slow_hours',
            voice,
            storeName: store.name,
            details,
            slowWindow: slow.label,
          }),
          slowWindow: slow.label,
        });
      }
    }

    if (store.planType === 'PRO') {
      const weekAgo = new Date(Date.now() - 7 * DAY_MS);
      const negativeCount = await this.prisma.feedback.count({
        where: {
          storeId,
          sentiment: 'NEGATIVE',
          createdAt: { gte: weekAgo },
        },
      });
      if (negativeCount >= 3) {
        const recoveryAudience = await this.audience(storeId, 'recover');
        if (recoveryAudience.count >= 1) {
          recs.unshift({
            id: 'feedback-recovery',
            objective: 'recover',
            origin: 'RECOMMENDED',
            reason: `${negativeCount} experiencias negativas esta semana. Conviene recuperar clientes insatisfechos con una promo.`,
            title: 'Recuperar clientes insatisfechos',
            audienceCount: recoveryAudience.count,
            messages: buildObjectiveMessages({
              kind: 'recover',
              voice,
              storeName: store.name,
              details: recommendedDetails(voice),
            }),
          });
        }
      }

    }

    const ending = cartillas.find((c) => {
      if (c.isDefault || !c.endsAt) return false;
      const days = (c.endsAt.getTime() - Date.now()) / DAY_MS;
      return days > 0 && days <= 10;
    });
    if (ending && !recs.some((r) => r.id === 'reactivate')) {
      const audience = await this.audience(storeId, 'reactivate');
      recs.unshift({
        id: 'cartilla-ending',
        objective: 'reactivate',
        origin: 'RECOMMENDED',
        reason: `La cartilla «${ending.name}» cierra pronto. Conviene avisar a quienes no han vuelto.`,
        title: `Aprovechar ${ending.name} antes de que cierre`,
        audienceCount: audience.count,
        messages: buildObjectiveMessages({
          kind: 'reactivate',
          voice,
          storeName: store.name,
          details: recommendedDetails(voice),
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
    audienceFilter?: AudienceFilter | null;
    audienceCount?: number;
    estimatedCostCop?: number;
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
    const filter = (body.audienceFilter ?? {
      objective: objectiveToKind(objective),
    }) as AudienceFilter;
    const selectedIds = Array.isArray(filter.selectedPassIds)
      ? new Set(filter.selectedPassIds.filter((id) => typeof id === 'string'))
      : null;
    const members = selectedIds?.size
      ? await this.resolveAllMembers(storeId)
      : await this.resolveMembers(storeId, filter);
    const effectiveMembers = selectedIds?.size
      ? members.filter((m) => selectedIds.has(m.passId))
      : members;
    const audienceCount = body.audienceCount ?? effectiveMembers.length;
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { planType: true, nextUsageBillingAt: true },
    });
    const window = usageWindow(store.nextUsageBillingAt);
    const reachUsed = await monthlyReachUsed(
      this.prisma,
      storeId,
      window.start,
      window.end
    );
    const quote = quoteReachCost(reachUsed, audienceCount, {
      planType: store.planType,
    });
    await assertCanLaunchReach(this.prisma, storeId, audienceCount);

    const title = (body.title || '').trim() || defaultTitle(objective);
    const smsBody = (body.smsBody || title).trim();
    const walletBody = (body.walletBody || title).trim();
    const channel = sendSms ? 'SMS' : 'WALLET';

    const campaign = await this.prisma.campaign.create({
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
        billingKind: quote.paidCount > 0 ? CampaignBillingKind.CREDIT : CampaignBillingKind.FREE,
        audienceCount,
        estimatedCostCop: body.estimatedCostCop ?? quote.costCop,
        audienceFilter: filter as Prisma.InputJsonValue,
      },
    });

    try {
      await this.jobs.enqueue(
        'campaign-dispatch',
        { campaignId: campaign.id },
        { delayMs: Math.max(0, delayMs) }
      );
    } catch (e) {
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.FAILED },
      });
      throw e instanceof Error
        ? new BadRequestException(`No se pudo programar el envío: ${e.message}`)
        : e;
    }
    return campaign;
  }

  async cancel(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException('Solo se pueden cancelar campañas programadas');
    }
    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED },
    });
    return this.prisma.campaign.findUniqueOrThrow({ where: { id } });
  }

  async relaunch(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== CampaignStatus.SENT) {
      throw new BadRequestException('Solo se pueden relanzar campañas ya enviadas');
    }
    // create() re-resuelve la audiencia al día (y respeta la selección guardada),
    // recalcula el costo por el cupo del mes y encola el envío.
    const created = await this.create({
      storeId: campaign.storeId,
      title: `${campaign.title} · Reintento`,
      objective: campaign.objective ? campaign.objective.toLowerCase() : 'reactivate',
      origin: campaign.origin,
      smsBody: campaign.smsBody ?? undefined,
      walletBody: campaign.walletBody ?? undefined,
      sendSms: campaign.sendSms,
      sendWallet: campaign.sendWallet,
      audienceFilter: (campaign.audienceFilter || undefined) as
        | AudienceFilter
        | undefined,
    });
    return this.prisma.campaign.update({
      where: { id: created.id },
      data: { groupId: campaign.groupId ?? campaign.id },
    });
  }

  async purchase(
    storeId: string,
    sku: 'single' | 'pack' | 'subscribe'
  ) {
    void storeId;
    void sku;
    throw new BadRequestException(
      'Las campañas se cobran por SMS extra en la siguiente factura de consumos. Configura tu tarjeta en Facturación si superas el cupo del plan.'
    );
  }

  async cancelPackSubscription(storeId: string) {
    void storeId;
    throw new BadRequestException('La suscripción de paquete de campañas ya no está disponible.');
  }

  async renewPackSubscription(storeId: string) {
    void storeId;
    this.logger.log('campaign-pack-renew omitido (legacy)');
  }

  async dispatch(payload: { campaignId: string }) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: payload.campaignId },
      include: { store: { select: { wompiPaymentSourceId: true, ownerEmail: true, slug: true, name: true } } },
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
    const selectedIds = Array.isArray(filter.selectedPassIds)
      ? new Set(filter.selectedPassIds.filter((id) => typeof id === 'string'))
      : null;
    const members = selectedIds?.size
      ? await this.resolveAllMembers(campaign.storeId)
      : await this.resolveMembers(campaign.storeId, {
          objective,
          slowWindow: filter.slowWindow,
          inactiveDays: filter.inactiveDays,
          minVisits: filter.minVisits,
          maxPointsGap: filter.maxPointsGap,
          activeWithinDays: filter.activeWithinDays,
          redeemWithinDays: filter.redeemWithinDays,
          negativeWithinDays: filter.negativeWithinDays,
          requireWallet: filter.requireWallet,
          cartillaId: filter.cartillaId,
        });
    const targets = selectedIds?.size
      ? members.filter((m) => selectedIds.has(m.passId))
      : members;

    const sentAt = new Date();
    const reached = new Map<
      string,
      {
        passId: string;
        userId: string;
        phone?: string | null;
        name: string;
        walletRef?: string | null;
        nearGap?: number | null;
        nextRewardTitle?: string | null;
      }
    >();

    for (const m of targets) {
      const canSms = campaign.sendSms && campaign.smsBody && m.phone;
      const canWallet = campaign.sendWallet && campaign.walletBody && m.walletRef;
      if (!canSms && !canWallet) continue;
      if (!reached.has(m.passId)) {
        reached.set(m.passId, m);
      }
    }

    const reachList = [...reached.values()];
    const reachCount = reachList.length;
    let smsReachCount = 0;
    for (const m of reachList) {
      if (campaign.sendSms && campaign.smsBody && m.phone) smsReachCount += 1;
    }
    const storeRow = await this.prisma.store.findUnique({
      where: { id: campaign.storeId },
      select: { planType: true, nextUsageBillingAt: true },
    });
    const window = usageWindow(storeRow?.nextUsageBillingAt);
    const reachUsedBefore = await monthlyReachUsed(
      this.prisma,
      campaign.storeId,
      window.start,
      window.end
    );
    const quote = quoteReachCost(reachUsedBefore, smsReachCount, {
      planType: storeRow?.planType,
    });

    try {
      // El extra de SMS se factura en el corte de consumos, no al enviar.

      let attempted = 0;
      let failed = 0;
      for (const m of reachList) {
        const feedbackUrl = buildFeedbackUrl({
          slug: campaign.store.slug,
          passId: m.passId,
        });
        const suffix = nextRewardSuffix(m.nearGap, m.nextRewardTitle);
        if (campaign.sendSms && campaign.smsBody && m.phone) {
          const base = renderCampaignTemplate(campaign.smsBody, {
            nombre: m.name.split(' ')[0] || 'tú',
            feedbackUrl,
            store: campaign.store.name,
          });
          // El cierre del premio cercano no se corta: se recorta el cuerpo si no cabe.
          const bodyBudget = 160 - suffix.length;
          const body =
            base.length <= bodyBudget ? base : `${base.slice(0, Math.max(0, bodyBudget)).trimEnd()}…`;
          attempted += 1;
          const res = await this.brevo.sendSms({ to: m.phone, message: body + suffix });
          if (!res.ok) failed += 1;
        }
        if (campaign.sendWallet && campaign.walletBody && m.walletRef) {
          attempted += 1;
          const res = await this.wallet.notify(
            m.walletRef,
            renderCampaignTemplate(campaign.walletBody, {
              nombre: m.name.split(' ')[0],
              feedbackUrl,
              store: campaign.store.name,
            }) + suffix
          );
          if (!res.ok) {
            failed += 1;
            this.logger.warn(`Wallet notify falló para ${m.walletRef} (${m.name})`);
          }
        }
      }

      if (attempted > 0 && failed === attempted) {
        throw new Error(
          `Ningún envío llegó a su destino: fallaron ${failed} de ${attempted}`
        );
      }
      if (failed > 0) {
        this.logger.warn(
          `Campaña ${campaign.id}: ${failed} de ${attempted} envíos fallaron (parcial)`
        );
      }

      await this.prisma.$transaction(async (tx) => {
        if (reachList.length > 0) {
          await tx.campaignReach.createMany({
            data: reachList.map((m) => ({
              campaignId: campaign.id,
              passId: m.passId,
              userId: m.userId,
              sentAt,
            })),
            skipDuplicates: true,
          });
        }
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.SENT,
            sentAt,
            reachCount,
            smsReachCount,
            freeReachApplied: quote.freeApplied,
            paidReachCount: quote.paidCount,
            costCop: quote.costCop,
          },
        });
      });

      this.logger.log(
        `Campaña ${campaign.id} enviada reach=${reachCount} cost=${quote.costCop} sms=${campaign.sendSms} wallet=${campaign.sendWallet}`
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

  async sweepStaleScheduled() {
    // Campañas SCHEDULED cuya hora ya pasó: su job de dispatch puede haberse
    // perdido (caída del proceso, fallo de encolado). Se re-encolan; dispatch
    // es idempotente vía el chequeo de status.
    const graceMs = 5 * 60 * 1000;
    const stale = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { lte: new Date(Date.now() - graceMs) },
      },
      select: { id: true, scheduledAt: true },
      take: 50,
    });
    for (const c of stale) {
      this.logger.warn(
        `Campaña ${c.id} SCHEDULED vencida (${c.scheduledAt?.toISOString() ?? 'sin fecha'}): re-encolando dispatch`
      );
      await this.jobs.enqueue('campaign-dispatch', { campaignId: c.id });
    }
    return { requeued: stale.length };
  }

  async evaluateCampaignSuccess(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { reaches: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== CampaignStatus.SENT || !campaign.sentAt) {
      throw new BadRequestException('Solo campañas enviadas tienen resultados');
    }

    const filter = (campaign.audienceFilter || {}) as AudienceFilter;
    const kind = filter.objective || objectiveToKind(campaign.objective);
    const windowDays = successWindowDays(kind);
    const windowEnd = new Date(
      campaign.sentAt.getTime() + windowDays * DAY_MS
    );
    const userIds = [...new Set(campaign.reaches.map((r) => r.userId))];
    const passIds = campaign.reaches.map((r) => r.passId);
    const reachCount = campaign.reachCount ?? campaign.reaches.length;

    let successUserIds = new Set<string>();

    if (kind === 'reviews') {
      const feedbacks = await this.prisma.feedback.findMany({
        where: {
          storeId: campaign.storeId,
          userId: { in: userIds },
          createdAt: { gte: campaign.sentAt, lte: windowEnd },
        },
        select: { userId: true, rating: true, redirectedToGoogle: true, sentiment: true },
      });
      for (const f of feedbacks) {
        if (
          f.redirectedToGoogle ||
          f.sentiment === 'POSITIVE' ||
          (f.rating != null && f.rating >= 4)
        ) {
          successUserIds.add(f.userId);
        }
      }
    } else {
      const txs = await this.prisma.transaction.findMany({
        where: {
          storeId: campaign.storeId,
          passId: { in: passIds },
          createdAt: { gte: campaign.sentAt, lte: windowEnd },
        },
        select: { passId: true, type: true },
      });
      const passToUser = new Map(campaign.reaches.map((r) => [r.passId, r.userId]));
      for (const tx of txs) {
        const uid = passToUser.get(tx.passId);
        if (!uid) continue;
        if (kind === 'new_reward') {
          if (tx.type === 'REDEEM' || tx.type === 'ACCUMULATE') {
            successUserIds.add(uid);
          }
        } else if (tx.type === 'ACCUMULATE') {
          successUserIds.add(uid);
        }
      }
    }

    const successCount = successUserIds.size;
    const successRate = reachCount > 0 ? successCount / reachCount : 0;
    const worked = campaignWorked(kind, successCount, reachCount);

    const salesAgg = await this.prisma.transaction.aggregate({
      where: {
        storeId: campaign.storeId,
        passId: { in: passIds },
        type: 'ACCUMULATE',
        createdAt: { gte: campaign.sentAt, lte: windowEnd },
        paymentAmount: { not: null },
      },
      _sum: { paymentAmount: true },
    });
    const attributedSalesCop = salesAgg._sum.paymentAmount ?? 0;
    const costCop = campaign.costCop ?? 0;
    const roiRatio = computeRoiRatio(attributedSalesCop, costCop);

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        successCount,
        successEvaluatedAt: new Date(),
        attributedSalesCop,
        roiRatio,
      },
    });

    return {
      campaignId,
      objective: kind,
      reachCount,
      audienceCount: campaign.audienceCount,
      successCount,
      successRate,
      worked,
      successLabel: successLabel(kind),
      attributedSalesCop,
      costCop,
      estimatedCostCop: campaign.estimatedCostCop,
      roiRatio,
      freeReachApplied: campaign.freeReachApplied,
      paidReachCount: campaign.paidReachCount,
      windowDays,
    };
  }

  async results(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');

    let metrics = null;
    if (campaign.status === CampaignStatus.SENT) {
      if (campaign.successEvaluatedAt) {
        const filter = (campaign.audienceFilter || {}) as AudienceFilter;
        const kind = filter.objective || objectiveToKind(campaign.objective);
        const reachCount = campaign.reachCount ?? 0;
        const successCount = campaign.successCount ?? 0;
        metrics = {
          objective: kind,
          reachCount,
          audienceCount: campaign.audienceCount,
          successCount,
          successRate: reachCount > 0 ? successCount / reachCount : 0,
          worked: campaignWorked(kind, successCount, reachCount),
          successLabel: successLabel(kind),
          attributedSalesCop: campaign.attributedSalesCop ?? 0,
          costCop: campaign.costCop ?? 0,
          estimatedCostCop: campaign.estimatedCostCop,
          roiRatio: campaign.roiRatio,
          freeReachApplied: campaign.freeReachApplied,
          paidReachCount: campaign.paidReachCount,
          windowDays: successWindowDays(kind),
        };
      } else {
        metrics = await this.evaluateCampaignSuccess(campaignId);
      }
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: campaign.storeId },
      select: { name: true, subcategory: true, segment: true },
    });
    const voice = voiceFor(
      store.subcategory as StoreSubcategory,
      store.segment as StoreSegment | null
    );
    const filter = (campaign.audienceFilter || {}) as AudienceFilter;
    const kind = filter.objective || objectiveToKind(campaign.objective);

    return {
      campaign,
      configuration: {
        objective: kind,
        objectiveLabel: objectiveLabel(kind, voice, filter),
        filter,
        smsBody: campaign.smsBody,
        walletBody: campaign.walletBody,
        sendSms: campaign.sendSms,
        sendWallet: campaign.sendWallet,
        scheduledAt: campaign.scheduledAt,
        sentAt: campaign.sentAt,
      },
      metrics,
      sends: await this.sendsForGroup(campaign),
    };
  }

  private async sendsForGroup(campaign: {
    id: string;
    storeId: string;
    groupId: string | null;
  }) {
    const groupKey = campaign.groupId ?? campaign.id;
    const siblings = await this.prisma.campaign.findMany({
      where: {
        storeId: campaign.storeId,
        OR: [{ id: groupKey }, { groupId: groupKey }],
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const s of siblings) {
      if (s.status === CampaignStatus.SENT && !s.successEvaluatedAt) {
        await this.evaluateCampaignSuccess(s.id);
      }
    }
    const refreshed = await this.prisma.campaign.findMany({
      where: {
        storeId: campaign.storeId,
        OR: [{ id: groupKey }, { groupId: groupKey }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return refreshed.map((s) => {
      const reach = s.reachCount ?? 0;
      const success = s.successCount ?? 0;
      return {
        id: s.id,
        status: s.status,
        sentAt: s.sentAt,
        scheduledAt: s.scheduledAt,
        audienceCount: s.audienceCount,
        reachCount: reach,
        successCount: success,
        successRate: reach > 0 ? success / reach : 0,
        costCop: s.costCop ?? 0,
        attributedSalesCop: s.attributedSalesCop ?? 0,
        roiRatio: s.roiRatio,
      };
    });
  }

  async analytics(
    storeId: string,
    from?: string,
    to?: string
  ) {
    if (!storeId) throw new BadRequestException('storeId es obligatorio');
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * DAY_MS);
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        storeId,
        status: CampaignStatus.SENT,
        sentAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { sentAt: 'asc' },
    });

    for (const c of campaigns) {
      if (!c.successEvaluatedAt) {
        await this.evaluateCampaignSuccess(c.id);
      }
    }

    const refreshed = await this.prisma.campaign.findMany({
      where: {
        storeId,
        status: CampaignStatus.SENT,
        sentAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { sentAt: 'asc' },
    });

    const byDate = new Map<
      string,
      {
        date: string;
        reach: number;
        successCount: number;
        costCop: number;
        attributedSalesCop: number;
        campaigns: number;
      }
    >();

    for (const c of refreshed) {
      const key = c.sentAt!.toISOString().slice(0, 10);
      const row = byDate.get(key) ?? {
        date: key,
        reach: 0,
        successCount: 0,
        costCop: 0,
        attributedSalesCop: 0,
        campaigns: 0,
      };
      row.reach += c.reachCount ?? 0;
      row.successCount += c.successCount ?? 0;
      row.costCop += c.costCop ?? 0;
      row.attributedSalesCop += c.attributedSalesCop ?? 0;
      row.campaigns += 1;
      byDate.set(key, row);
    }

    const series = [...byDate.values()].map((row) => ({
      ...row,
      successRate: row.reach > 0 ? row.successCount / row.reach : 0,
      roi: row.costCop > 0 ? row.attributedSalesCop / row.costCop : null,
    }));

    const totalReach = refreshed.reduce((s, c) => s + (c.reachCount ?? 0), 0);
    const totalSuccess = refreshed.reduce((s, c) => s + (c.successCount ?? 0), 0);
    const totalCost = refreshed.reduce((s, c) => s + (c.costCop ?? 0), 0);
    const totalSales = refreshed.reduce(
      (s, c) => s + (c.attributedSalesCop ?? 0),
      0
    );

    const perCampaign = refreshed.map((c) => {
      const filter = (c.audienceFilter || {}) as AudienceFilter;
      const kind = filter.objective || objectiveToKind(c.objective);
      const reach = c.reachCount ?? 0;
      const success = c.successCount ?? 0;
      return {
        id: c.id,
        title: c.title,
        objective: kind,
        sentAt: c.sentAt,
        audienceCount: c.audienceCount,
        reachCount: reach,
        successCount: success,
        successRate: reach > 0 ? success / reach : 0,
        worked: campaignWorked(kind, success, reach),
        costCop: c.costCop ?? 0,
        attributedSalesCop: c.attributedSalesCop ?? 0,
        roiRatio: c.roiRatio,
      };
    });

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      kpis: {
        totalReach,
        avgSuccessRate: totalReach > 0 ? totalSuccess / totalReach : 0,
        totalCost,
        totalAttributedSales: totalSales,
        weightedRoi: totalCost > 0 ? totalSales / totalCost : null,
      },
      series,
      campaigns: perCampaign,
    };
  }

  private async resolveAllMembers(storeId: string) {
    const { mapped } = await this.loadMappedPasses(storeId);
    return mapped;
  }

  private async loadMappedPasses(storeId: string) {
    const passes = await this.prisma.pass.findMany({
      where: { storeId },
      include: {
        user: true,
        promoAssignments: { include: { promotion: true } },
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    const now = Date.now();
    const feedbacks = await this.prisma.feedback.findMany({
      where: { storeId },
      select: { userId: true, sentiment: true, createdAt: true },
    });
    const feedbackUserIds = new Set(feedbacks.map((f) => f.userId));
    // Días desde la experiencia negativa más reciente por usuario.
    const negativeDaysByUser = new Map<string, number>();
    for (const f of feedbacks) {
      if (f.sentiment !== 'NEGATIVE') continue;
      const days = (now - f.createdAt.getTime()) / DAY_MS;
      const prev = negativeDaysByUser.get(f.userId);
      if (prev == null || days < prev) negativeDaysByUser.set(f.userId, days);
    }
    return {
      mapped: passes.map((p) =>
        this.mapPass(p, now, feedbackUserIds, negativeDaysByUser)
      ),
    };
  }

  private async resolveMembers(storeId: string, filter: AudienceFilter) {
    const { mapped } = await this.loadMappedPasses(storeId);
    const members = this.applyObjectiveFilter(mapped, filter);
    if (filter.requireWallet) {
      return members.filter((m) => m.walletRef);
    }
    return members;
  }

  private applyObjectiveFilter(mapped: MemberRow[], filter: AudienceFilter) {
    let members: MemberRow[];
    switch (filter.objective) {
      case 'reactivate': {
        const days = filter.inactiveDays ?? 21;
        const minVisits = filter.minVisits ?? 1;
        members = mapped.filter(
          (m) => m.daysSince >= days && m.visits >= minVisits
        );
        break;
      }
      case 'slow_hours': {
        const minVisits = filter.minVisits ?? 1;
        members = mapped.filter((m) => m.visits >= minVisits);
        break;
      }
      case 'recover': {
        const days = filter.negativeWithinDays ?? 30;
        members = mapped.filter(
          (m) =>
            m.daysSinceNegativeFeedback != null &&
            m.daysSinceNegativeFeedback <= days
        );
        break;
      }
      case 'new_reward': {
        const gap = filter.maxPointsGap ?? 2;
        const activeDays = filter.activeWithinDays ?? 14;
        members = mapped.filter(
          (m) =>
            m.visits > 0 &&
            (m.nearGap == null || m.nearGap <= gap || m.daysSince <= activeDays)
        );
        break;
      }
      case 'reviews': {
        const redeemDays = filter.redeemWithinDays ?? 14;
        members = mapped.filter(
          (m) =>
            !m.hasFeedback &&
            m.daysSinceRedeem != null &&
            m.daysSinceRedeem <= redeemDays
        );
        break;
      }
      default:
        members = mapped.filter((m) => m.visits > 0);
    }
    return members;
  }

  private mapPass(
    p: PassRow,
    now: number,
    feedbackUserIds: Set<string>,
    negativeDaysByUser: Map<string, number>
  ): MemberRow {
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
    const nextRewardTitle = next?.title ?? null;
    const lastRedeem = p.transactions.find((t) => t.type === 'REDEEM');
    const daysSinceRedeem = lastRedeem
      ? (now - lastRedeem.createdAt.getTime()) / DAY_MS
      : null;
    const redeemedRecently = Boolean(
      daysSinceRedeem != null && daysSinceRedeem <= 14
    );
    const name = p.user.name || p.user.phone;
    const daysSinceNegative = negativeDaysByUser.get(p.userId) ?? null;
    let meta = lastTx
      ? `hace ${Math.max(1, Math.round(daysSince))} días`
      : 'sin visitas';
    if (nearGap != null && nearGap <= 2) meta = `${p.points} ondas · cerca del premio`;
    if (redeemedRecently && lastRedeem) {
      meta = `canjeó hace ${Math.max(1, Math.round((now - lastRedeem.createdAt.getTime()) / DAY_MS))} días`;
    }
    if (daysSinceNegative != null) {
      meta = `queja hace ${Math.max(1, Math.round(daysSinceNegative))} días`;
    }
    return {
      passId: p.id,
      userId: p.userId,
      walletRef: p.walletRef,
      phone: p.user.phone,
      name,
      daysSince,
      visits,
      nearGap,
      nextRewardTitle,
      redeemedRecently,
      daysSinceRedeem,
      daysSinceNegativeFeedback: daysSinceNegative,
      hasFeedback: feedbackUserIds.has(p.userId),
      meta,
    };
  }

  /** Ventana menos concurrida de los últimos 30 días, en formato estructurado. */
  private async slowWindowForStore(storeId: string, fallback: string) {
    const base = {
      label: fallback,
      recommend: false,
      dows: null as number[] | null,
      startHour: null as number | null,
      endHour: null as number | null,
      transactions: 0,
      basedOnDays: 30,
    };
    const from = new Date(Date.now() - 30 * DAY_MS);
    const txs = await this.prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: from } },
      select: { createdAt: true },
    });
    if (txs.length < 8) {
      return base;
    }
    const cells = Array.from({ length: 7 * 24 }, () => 0);
    for (const tx of txs) {
      const jsDay = tx.createdAt.getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1; // 0 = lunes … 6 = domingo
      cells[dow * 24 + tx.createdAt.getHours()] += 1;
    }
    let best = { score: Infinity, dow: 1, hour: 14 };
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 6; hour <= 20; hour++) {
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
    const dows =
      best.dow + 1 <= 7
        ? [...new Set([best.dow + 1, Math.min(best.dow + 2, 7)])]
        : [7];
    const startHour = best.hour;
    const endHour = best.hour + 3;
    const label =
      dows.length === 2
        ? `${DOW_LABELS[dows[0] - 1]} y ${DOW_LABELS[dows[1] - 1]} de ${formatHour(startHour)} a ${formatHour(endHour)}`
        : `${DOW_LABELS[dows[0] - 1]} de ${formatHour(startHour)} a ${formatHour(endHour)}`;
    return {
      label,
      recommend: windowPeak < peak * 0.55,
      dows,
      startHour,
      endHour,
      transactions: txs.length,
      basedOnDays: 30,
    };
  }

  /** Propuesta determinística de parámetros según el objetivo, basada en datos reales. */
  async propose(storeId: string, objective: ObjectiveKind) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { subcategory: true, segment: true },
    });
    const voice = voiceFor(
      store.subcategory as StoreSubcategory,
      store.segment as StoreSegment | null
    );

    switch (objective) {
      case 'slow_hours': {
        const slow = await this.slowWindowForStore(storeId, voice.slowWindow);
        if (!slow.dows) {
          return {
            objective,
            patch: {},
            label: `Con ${slow.transactions} movimientos en ${slow.basedOnDays} días aún no alcanza para proponer una ventana`,
            basedOnDays: slow.basedOnDays,
            sampleSize: slow.transactions,
          };
        }
        return {
          objective,
          patch: {
            slowDows: slow.dows,
            slowStartHour: slow.startHour,
            slowEndHour: slow.endHour,
          },
          label: `Menos concurrida: ${slow.label} (${slow.transactions} movimientos en ${slow.basedOnDays} días)`,
          basedOnDays: slow.basedOnDays,
          sampleSize: slow.transactions,
        };
      }

      case 'reactivate': {
        const basedOnDays = 90;
        const since = new Date(Date.now() - basedOnDays * DAY_MS);
        const txs = await this.prisma.transaction.findMany({
          where: { storeId, type: 'ACCUMULATE', createdAt: { gte: since } },
          select: { passId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const lastByPass = new Map<string, Date>();
        for (const t of txs) {
          if (!lastByPass.has(t.passId)) lastByPass.set(t.passId, t.createdAt);
        }
        if (lastByPass.size < 8) {
          return {
            objective,
            patch: {},
            label: `Con ${lastByPass.size} pases activos en ${basedOnDays} días aún no alcanza para proponer un umbral`,
            basedOnDays,
            sampleSize: lastByPass.size,
          };
        }
        const now = Date.now();
        const gaps = [...lastByPass.values()]
          .map((d) => (now - d.getTime()) / DAY_MS)
          .sort((a, b) => a - b);
        const p75 = gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.75))];
        const inactiveDays = Math.max(7, Math.min(180, Math.round(p75)));
        return {
          objective,
          patch: { inactiveDays },
          label: `El 25% más inactivo lleva más de ${inactiveDays} días sin volver (${lastByPass.size} pases en ${basedOnDays} días)`,
          basedOnDays,
          sampleSize: lastByPass.size,
        };
      }

      case 'recover': {
        const basedOnDays = 60;
        const since = new Date(Date.now() - basedOnDays * DAY_MS);
        const negatives = await this.prisma.feedback.findMany({
          where: { storeId, sentiment: 'NEGATIVE', createdAt: { gte: since } },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        if (negatives.length === 0) {
          return {
            objective,
            patch: {},
            label: `Sin feedback negativo en los últimos ${basedOnDays} días`,
            basedOnDays,
            sampleSize: 0,
          };
        }
        const daysSinceOldest =
          (Date.now() - negatives[0].createdAt.getTime()) / DAY_MS;
        const negativeWithinDays = Math.max(
          1,
          Math.min(90, Math.ceil(daysSinceOldest))
        );
        return {
          objective,
          patch: { negativeWithinDays },
          label: `${negatives.length} quejas en los últimos ${negativeWithinDays} días`,
          basedOnDays,
          sampleSize: negatives.length,
        };
      }

      default:
        throw new BadRequestException(
          `El objetivo "${objective}" no tiene propuesta automática`
        );
    }
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

function chipsFor(kind: ObjectiveKind, filter: AudienceFilter) {
  const slowWindow = filter.slowWindow || '';
  switch (kind) {
    case 'reactivate':
      return [
        `Inactivos ${filter.inactiveDays ?? 21}d`,
        filter.minVisits && filter.minVisits > 1
          ? `${filter.minVisits}+ visitas`
          : 'Visitaron antes',
        filter.requireWallet ? 'Solo Wallet' : 'Wallet o SMS',
      ];
    case 'slow_hours':
      return [
        'Ya conocen el local',
        slowWindow,
        filter.requireWallet ? 'Solo Wallet' : 'Invitación a horario flojo',
      ];
    case 'recover':
      return [
        `Mala experiencia ≤ ${filter.negativeWithinDays ?? 30}d`,
        'Feedback negativo',
        filter.requireWallet ? 'Solo Wallet' : 'Disculpa + invitación',
      ];
    case 'new_reward':
      return [
        'Activos',
        `≤ ${filter.maxPointsGap ?? 2} ondas al premio`,
        `${filter.activeWithinDays ?? 14}d de actividad`,
      ];
    case 'reviews':
      return [
        `Canje ≤ ${filter.redeemWithinDays ?? 14}d`,
        'Sin reseña',
        filter.requireWallet ? 'Solo Wallet' : 'Google Reviews',
      ];
  }
}

function headlineFor(
  kind: ObjectiveKind,
  count: number,
  voice: ReturnType<typeof voiceFor>,
  filter: AudienceFilter
) {
  const slowWindow = filter.slowWindow || voice.slowWindow;
  const inactiveDays = filter.inactiveDays ?? 21;
  const minVisits = filter.minVisits ?? 1;
  const maxPointsGap = filter.maxPointsGap ?? 2;
  const activeWithinDays = filter.activeWithinDays ?? 14;
  const redeemWithinDays = filter.redeemWithinDays ?? 14;
  const negativeWithinDays = filter.negativeWithinDays ?? 30;

  if (count === 0) {
    return `Aún no hay ${voice.customerPlural} para este objetivo.`;
  }
  switch (kind) {
    case 'reactivate':
      return minVisits > 1
        ? `Encontramos ${count} ${voice.customerPlural} con ${minVisits}+ visitas que no regresan hace más de ${inactiveDays} días.`
        : `Encontramos ${count} ${voice.customerPlural} que no regresan hace más de ${inactiveDays} días.`;
    case 'slow_hours':
      return `Encontramos ${count} ${voice.customerPlural} a quienes invitar ${slowWindow}.`;
    case 'recover':
      return `Encontramos ${count} ${voice.customerPlural} que tuvieron una mala experiencia en los últimos ${negativeWithinDays} días.`;
    case 'new_reward':
      return `Encontramos ${count} ${voice.customerPlural} a ${maxPointsGap} ondas del premio o activos en ${activeWithinDays} días.`;
    case 'reviews':
      return `Encontramos ${count} ${voice.customerPlural} que canjearon en los últimos ${redeemWithinDays} días y aún no dejaron reseña.`;
  }
}

function clampInt(
  raw: number | undefined,
  min: number,
  max: number,
  fallback: number
) {
  if (raw == null || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function parseObjective(raw?: string): CampaignObjective | null {
  const key = (raw || '').toLowerCase();
  switch (key) {
    case 'reactivate':
      return CampaignObjective.REACTIVATE;
    case 'slow_hours':
      return CampaignObjective.SLOW_HOURS;
    case 'recover':
      return CampaignObjective.RECOVER;
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
    case CampaignObjective.RECOVER:
      return 'recover';
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
    case CampaignObjective.RECOVER:
      return 'Campaña de recuperación';
    case CampaignObjective.NEW_REWARD:
      return 'Campaña nueva recompensa';
    case CampaignObjective.REVIEWS:
      return 'Campaña reseñas';
    default:
      return 'Campaña de reactivación';
  }
}

function recommendedDetails(
  voice: ReturnType<typeof voiceFor>,
  patch?: Partial<AudienceFilter>
) {
  return {
    inactiveDays: patch?.inactiveDays ?? 21,
    minVisits: patch?.minVisits ?? 1,
    slowWindow: patch?.slowWindow ?? voice.slowWindow,
    rewardName: patch?.rewardName ?? voice.signatureReward,
    maxPointsGap: patch?.maxPointsGap ?? 2,
    activeWithinDays: patch?.activeWithinDays ?? 14,
    reviewIncentive: patch?.reviewIncentive ?? '1 onda extra por reseña',
    redeemWithinDays: patch?.redeemWithinDays ?? 14,
    negativeWithinDays: patch?.negativeWithinDays ?? 30,
    requireWallet: patch?.requireWallet ?? false,
  };
}
