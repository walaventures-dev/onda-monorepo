import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedbackFollowUpStatus,
  FeedbackSentiment,
  FeedbackSource,
} from '@prisma/client';
import { feedbackDimensionsFor } from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { CustomerAuthService } from './customer-auth.service';
import { BrevoService } from './brevo.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';
import { GooglePlacesService } from './google-places.service';
import { googleWriteReviewUrl } from './feedback-url';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(BrevoService) private brevo: BrevoService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService,
    @Inject(GooglePlacesService) private places: GooglePlacesService
  ) {}

  private assertPro(store: { planType: string }) {
    if (store.planType !== 'PRO') {
      throw new ForbiddenException(
        'El módulo de feedback está disponible en plan PRO'
      );
    }
  }

  async getDimensions(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    this.assertPro(store);
    return feedbackDimensionsFor(store.subcategory, store.segment);
  }

  async create(input: {
    token?: string;
    passId: string;
    storeId: string;
    sentiment: FeedbackSentiment;
    dimensions: string[];
    comment?: string;
    source?: FeedbackSource;
    transactionId?: string;
  }) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: input.storeId },
    });
    this.assertPro(store);

    const pass = await this.prisma.pass.findFirst({
      where: { id: input.passId, storeId: input.storeId },
      include: { user: true },
    });
    if (!pass) throw new NotFoundException('Pase no encontrado');

    if (input.token) {
      const user = await this.auth.requireSession(input.token);
      if (user.id !== pass.userId) {
        throw new ForbiddenException('Este pase no pertenece a tu sesión');
      }
    }

    const rating =
      input.sentiment === FeedbackSentiment.POSITIVE ? 5 : 2;
    const reviewGating = store.planType === 'PRO';
    const redirectedToGoogle =
      reviewGating &&
      input.sentiment === FeedbackSentiment.POSITIVE &&
      Boolean(store.googlePlaceId);

    const feedback = await this.prisma.feedback.create({
      data: {
        userId: pass.userId,
        storeId: input.storeId,
        passId: pass.id,
        transactionId: input.transactionId,
        rating,
        sentiment: input.sentiment,
        dimensions: input.dimensions.slice(0, 5),
        source: input.source || FeedbackSource.MANUAL,
        comment: input.comment?.trim() || undefined,
        redirectedToGoogle,
        followUpStatus:
          input.sentiment === FeedbackSentiment.NEGATIVE
            ? FeedbackFollowUpStatus.OPEN
            : FeedbackFollowUpStatus.RESOLVED,
      },
      include: { user: true },
    });

    this.sse.emit(input.storeId, {
      kind: 'feedback_new',
      feedbackId: feedback.id,
      storeId: input.storeId,
      sentiment: feedback.sentiment,
    });

    const alertMerchant =
      reviewGating && input.sentiment === FeedbackSentiment.NEGATIVE;
    if (alertMerchant) {
      await this.notifyNegativeFeedback(store, feedback);
    }

    return {
      feedback,
      redirectToGoogle: redirectedToGoogle,
      googleMapsUrl: store.googlePlaceId
        ? googleWriteReviewUrl(store.googlePlaceId)
        : null,
      alertMerchant,
    };
  }

  private async notifyNegativeFeedback(
    store: {
      id: string;
      name: string;
      ownerEmail?: string | null;
      subcategory: string;
      segment?: string | null;
    },
    feedback: {
      id: string;
      comment?: string | null;
      dimensions: string[];
      user: { name: string; phone: string };
    }
  ) {
    this.sse.emit(store.id, {
      kind: 'feedback_alert',
      feedbackId: feedback.id,
      storeId: store.id,
      sentiment: 'NEGATIVE',
    });

    if (!store.ownerEmail) return;
    const dims = feedbackDimensionsFor(store.subcategory, store.segment);
    const dimLabels = feedback.dimensions
      .map((id) => dims.find((d) => d.id === id)?.label || id)
      .join(', ');

    try {
      await this.brevo.sendEmail({
        to: store.ownerEmail,
        toName: store.name,
        subject: `Alerta de insatisfacción — ${store.name}`,
        html: `<p>Un cliente reportó una experiencia negativa en <strong>${store.name}</strong>.</p>
<p><strong>Cliente:</strong> ${feedback.user.name || feedback.user.phone}</p>
<p><strong>Aspectos:</strong> ${dimLabels || '—'}</p>
<p><strong>Comentario:</strong> ${feedback.comment || '—'}</p>
<p>Revisa el módulo de Feedback en tu panel Onda.</p>`,
      });
    } catch (err) {
      this.logger.warn(
        `Email alerta feedback falló: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  async list(storeId: string, limit = 100) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    this.assertPro(store);
    return this.prisma.feedback.findMany({
      where: { storeId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updateFollowUp(
    storeId: string,
    feedbackId: string,
    status: FeedbackFollowUpStatus
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    this.assertPro(store);
    const existing = await this.prisma.feedback.findFirst({
      where: { id: feedbackId, storeId },
    });
    if (!existing) throw new NotFoundException('Feedback no encontrado');
    return this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { followUpStatus: status },
      include: { user: true },
    });
  }

  async analytics(storeId: string, days = 30) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    this.assertPro(store);

    const since = new Date(Date.now() - days * DAY_MS);
    const [feedbacks, accumulations, googleDelta] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { storeId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.transaction.count({
        where: {
          storeId,
          type: 'ACCUMULATE',
          createdAt: { gte: since },
        },
      }),
      this.places.googleComparison(storeId),
    ]);

    const total = feedbacks.length;
    const positive = feedbacks.filter(
      (f) => f.sentiment === FeedbackSentiment.POSITIVE
    ).length;
    const googleRedirects = feedbacks.filter((f) => f.redirectedToGoogle).length;
    const openAlerts = feedbacks.filter(
      (f) =>
        f.sentiment === FeedbackSentiment.NEGATIVE &&
        f.followUpStatus === FeedbackFollowUpStatus.OPEN
    ).length;

    const seriesMap = new Map<string, { positive: number; negative: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * DAY_MS);
      seriesMap.set(dateKey(d), { positive: 0, negative: 0 });
    }
    for (const f of feedbacks) {
      const key = dateKey(f.createdAt);
      const row = seriesMap.get(key);
      if (!row) continue;
      if (f.sentiment === FeedbackSentiment.POSITIVE) row.positive++;
      else row.negative++;
    }

    const dims = feedbackDimensionsFor(store.subcategory, store.segment);
    const dimCounts = new Map<
      string,
      { count: number; sentiment: FeedbackSentiment }
    >();
    for (const f of feedbacks) {
      for (const id of f.dimensions) {
        const prev = dimCounts.get(id);
        if (!prev || f.sentiment === FeedbackSentiment.NEGATIVE) {
          dimCounts.set(id, { count: (prev?.count || 0) + 1, sentiment: f.sentiment });
        } else {
          dimCounts.set(id, { count: prev.count + 1, sentiment: prev.sentiment });
        }
      }
    }
    const topDimensions = [...dimCounts.entries()]
      .map(([id, v]) => ({
        id,
        label: dims.find((d) => d.id === id)?.label || id,
        count: v.count,
        sentiment: v.sentiment,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      responseRate: accumulations > 0 ? total / accumulations : 0,
      positiveRate: total > 0 ? positive / total : 0,
      googleRedirects,
      openAlerts,
      total,
      series: [...seriesMap.entries()].map(([date, v]) => ({
        date,
        ...v,
      })),
      topDimensions,
      googleDelta: googleDelta || {
        ratingBefore: null,
        ratingNow: null,
        reviewsBefore: null,
        reviewsNow: null,
      },
    };
  }

  async shouldSendFeedbackSms(passId: string) {
    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      select: { lastFeedbackSmsAt: true },
    });
    if (!pass?.lastFeedbackSmsAt) return true;
    return Date.now() - pass.lastFeedbackSmsAt.getTime() >= DAY_MS;
  }

  async markFeedbackSmsSent(passId: string) {
    await this.prisma.pass.update({
      where: { id: passId },
      data: { lastFeedbackSmsAt: new Date() },
    });
  }

  async sendPostAccumulateSms(input: {
    store: { id: string; name: string; slug: string; planType: string };
    passId: string;
    phone: string;
    message: string;
  }) {
    if (input.store.planType !== 'PRO') return;
    if (!(await this.shouldSendFeedbackSms(input.passId))) return;

    try {
      await this.brevo.sendSms({ to: input.phone, message: input.message });
      await this.markFeedbackSmsSent(input.passId);
    } catch (err) {
      this.logger.warn(
        `SMS feedback post-acumulación falló: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  async recentNegativeCount(storeId: string, days = 7) {
    const since = new Date(Date.now() - days * DAY_MS);
    return this.prisma.feedback.count({
      where: {
        storeId,
        sentiment: FeedbackSentiment.NEGATIVE,
        createdAt: { gte: since },
      },
    });
  }

  async dissatisfiedPassIds(storeId: string, days = 30) {
    const since = new Date(Date.now() - days * DAY_MS);
    const rows = await this.prisma.feedback.findMany({
      where: {
        storeId,
        sentiment: FeedbackSentiment.NEGATIVE,
        createdAt: { gte: since },
      },
      select: { passId: true },
      distinct: ['passId'],
    });
    return rows.map((r) => r.passId).filter(Boolean) as string[];
  }
}
