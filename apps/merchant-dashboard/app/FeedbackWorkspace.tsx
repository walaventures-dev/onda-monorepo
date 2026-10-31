'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CaretDown,
  CaretUp,
  ChatCircleDots,
  ClockCounterClockwise,
  MagnifyingGlass,
  MapPin,
  Smiley,
  SmileyAngry,
  SmileyMeh,
  SmileySad,
  SmileyWink,
  Star,
  TrendUp,
} from '@phosphor-icons/react';
import {
  api,
  GradientButton,
  OndaSelect,
  SkeletonDashboard,
  toast,
} from '@onda/shared-ui';
import type { FeedbackAnalyticsDto, FeedbackDto } from '@onda/shared-types';
import { feedbackDimensionLabel, feedbackDimensionsFor } from '@onda/shared-utils';
import { useStoreSse } from '../lib/useStoreSse';
import { mockAnalytics, mockFeedbacks } from './feedback.mock';

// TODO: quitar antes de producción — muestra el módulo con datos de ejemplo
const MOCK_FEEDBACK = true;

const PAGE_SIZE = 8;

type SortKey = 'date' | 'client' | 'experience' | 'analysis' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER = { OPEN: 0, CONTACTED: 1, RESOLVED: 2 } as const;

type SentimentBucket = {
  id: string;
  label: string;
  test: (score: number) => boolean;
  icon: typeof Smiley;
  iconClass: string;
  barClass: string;
  badgeClass: string;
};

const SENTIMENT_BUCKETS: SentimentBucket[] = [
  {
    id: 'very-negative',
    label: 'Muy negativo',
    test: (s) => s <= -0.5,
    icon: SmileyAngry,
    iconClass: 'text-[var(--onda-danger)]',
    barClass: 'bg-[var(--onda-danger)]',
    badgeClass: 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]',
  },
  {
    id: 'negative',
    label: 'Negativo',
    test: (s) => s <= -0.1,
    icon: SmileySad,
    iconClass: 'text-orange-500',
    barClass: 'bg-orange-400',
    badgeClass: 'bg-orange-500/10 text-orange-600',
  },
  {
    id: 'neutral',
    label: 'Neutro',
    test: (s) => Math.abs(s) < 0.1,
    icon: SmileyMeh,
    iconClass: 'text-[var(--onda-muted)]',
    barClass: 'bg-[var(--onda-muted)]',
    badgeClass: 'bg-black/5 text-[var(--onda-muted)]',
  },
  {
    id: 'positive',
    label: 'Positivo',
    test: (s) => s < 0.5,
    icon: Smiley,
    iconClass: 'text-lime-600',
    barClass: 'bg-lime-500',
    badgeClass: 'bg-lime-500/10 text-lime-700',
  },
  {
    id: 'very-positive',
    label: 'Muy positivo',
    test: () => true,
    icon: SmileyWink,
    iconClass: 'text-[var(--onda-success)]',
    barClass: 'bg-[var(--onda-success)]',
    badgeClass: 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]',
  },
];

function sentimentBucket(score: number | null | undefined) {
  if (score == null) return null;
  return SENTIMENT_BUCKETS.find((b) => b.test(score)) || null;
}

function sentimentTag(score: number | null | undefined) {
  const bucket = sentimentBucket(score);
  if (!bucket) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bucket.badgeClass}`}
    >
      <bucket.icon className="h-3.5 w-3.5" weight="fill" aria-hidden />
      {bucket.label}
      <span className="opacity-60">{score!.toFixed(2)}</span>
    </span>
  );
}

type Props = {
  storeId: string;
  planType?: string;
  subcategory?: string;
  segment?: string | null;
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function FeedbackWorkspace({
  storeId,
  planType,
  subcategory,
  segment,
}: Props) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<FeedbackAnalyticsDto | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setPage(1);
  }, [query, experienceFilter, statusFilter]);

  const visibleFeedbacks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = feedbacks.filter((f) => {
      if (experienceFilter !== 'ALL' && f.sentiment !== experienceFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && f.followUpStatus !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${f.user?.name || ''} ${f.user?.phone || ''} ${
          f.comment || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'client':
          cmp = (a.user?.name || a.user?.phone || '').localeCompare(
            b.user?.name || b.user?.phone || '',
            'es'
          );
          break;
        case 'experience':
          cmp = a.rating - b.rating;
          break;
        case 'analysis':
          cmp =
            (a.sentimentScore ?? Number.NEGATIVE_INFINITY) -
            (b.sentimentScore ?? Number.NEGATIVE_INFINITY);
          break;
        case 'status':
          cmp =
            STATUS_ORDER[a.followUpStatus as keyof typeof STATUS_ORDER] -
            STATUS_ORDER[b.followUpStatus as keyof typeof STATUS_ORDER];
          break;
      }
      if ((a.sentimentScore == null || b.sentimentScore == null) && sortKey === 'analysis') {
        if (a.sentimentScore == null && b.sentimentScore != null) return 1;
        if (a.sentimentScore != null && b.sentimentScore == null) return -1;
      }
      return cmp * dir;
    });
  }, [feedbacks, query, experienceFilter, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

  const sentimentDist = useMemo(() => {
    const analyzed = feedbacks.filter(
      (f) => f.sentimentScore != null
    ) as (FeedbackDto & { sentimentScore: number })[];
    const max = Math.max(
      1,
      ...SENTIMENT_BUCKETS.map(
        (b) => analyzed.filter((f) => b.test(f.sentimentScore)).length
      )
    );
    return SENTIMENT_BUCKETS.map((bucket) => {
      const count = analyzed.filter((f) => bucket.test(f.sentimentScore)).length;
      return { bucket, count, pctWidth: (count / max) * 100 };
    });
  }, [feedbacks]);

  const totalPages = Math.max(1, Math.ceil(visibleFeedbacks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visibleFeedbacks.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const dims = useMemo(() => {
    if (MOCK_FEEDBACK) return feedbackDimensionsFor('CAFE', segment);
    return subcategory ? feedbackDimensionsFor(subcategory, segment) : [];
  }, [subcategory, segment]);

  const load = useCallback(async (silent = false) => {
    if (!MOCK_FEEDBACK && planType !== 'PRO') {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    if (MOCK_FEEDBACK) {
      setAnalytics(mockAnalytics);
      setFeedbacks(mockFeedbacks);
      setLoading(false);
      return;
    }
    try {
      const [a, list] = await Promise.all([
        api<FeedbackAnalyticsDto>(`/feedback/store/${storeId}/analytics?days=30`),
        api<FeedbackDto[]>(`/feedback/store/${storeId}`),
      ]);
      setAnalytics(a);
      setFeedbacks(list);
    } catch (err: any) {
      if (!silent) toast(err.message || 'No se pudo cargar feedback');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [storeId, planType]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useStoreSse(storeId, MOCK_FEEDBACK || planType === 'PRO', (payload) => {
    if (MOCK_FEEDBACK) return;
    if (payload.kind !== 'feedback_new' && payload.kind !== 'feedback_alert') {
      return;
    }
    void load(true);
  });

  const [contactTarget, setContactTarget] = useState<FeedbackDto | null>(null);
  const [resolveTarget, setResolveTarget] = useState<FeedbackDto | null>(null);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [smsQuota, setSmsQuota] = useState<{
    reachUsed: number;
    reachLimit: number;
    freeRemaining: number;
    unitCop: number;
  } | null>(null);

  useEffect(() => {
    if (!contactTarget) return;
    if (MOCK_FEEDBACK) {
      setSmsQuota({ reachUsed: 84, reachLimit: 100, freeRemaining: 16, unitCop: 45 });
      return;
    }
    api<any>(`/campaigns/quota?storeId=${storeId}`)
      .then((q) =>
        setSmsQuota({
          reachUsed: q.reachUsed,
          reachLimit: q.reachLimit,
          freeRemaining: q.freeRemaining,
          unitCop: q.unitCop,
        })
      )
      .catch(() => setSmsQuota(null));
  }, [contactTarget, storeId]);

  async function updateFollowUp(
    feedbackId: string,
    status: 'OPEN' | 'CONTACTED' | 'RESOLVED',
    opts?: { message?: string; note?: string }
  ) {
    if (MOCK_FEEDBACK) {
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === feedbackId
            ? {
                ...f,
                followUpStatus: status,
                followUpNote:
                  opts?.message?.trim() || opts?.note?.trim() || f.followUpNote,
              }
            : f
        )
      );
      return;
    }
    setFollowUpBusy(true);
    try {
      await api(`/feedback/${feedbackId}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId, status, ...opts }),
      });
      toast(
        status === 'CONTACTED'
          ? 'Mensaje enviado al cliente'
          : 'Caso marcado como resuelto'
      );
      void load(true);
    } catch (err: any) {
      toast(err.message || 'No se pudo actualizar');
      throw err;
    } finally {
      setFollowUpBusy(false);
    }
  }

  if (!MOCK_FEEDBACK && planType !== 'PRO') {
    return (
      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-8 text-center">
        <p className="font-display text-xl font-semibold text-[var(--onda-ink)]">
          Feedback disponible en plan PRO
        </p>
        <p className="mt-2 text-sm text-[var(--onda-muted)]">
          Activa PRO para recibir opiniones de clientes, alertas de insatisfacción
          y seguimiento de reseñas en Google.
        </p>
      </div>
    );
  }

  if (loading || !analytics) {
    return <SkeletonDashboard kpis={4} />;
  }

  const dimChart = analytics.topDimensions.map((d) => ({
    name: d.label,
    count: d.count,
    fill:
      d.sentiment === 'POSITIVE'
        ? 'var(--onda-success)'
        : 'var(--onda-danger)',
  }));

  const openNegative = feedbacks.filter(
    (f) => f.sentiment === 'NEGATIVE' && f.followUpStatus === 'OPEN'
  );

  const g = analytics.googleDelta;
  const ratingBefore = g.ratingBefore;
  const ratingNow = g.ratingNow;
  const reviewsBefore = g.reviewsBefore;
  const reviewsNow = g.reviewsNow;
  const ratingDelta =
    ratingNow != null && ratingBefore != null ? ratingNow - ratingBefore : null;
  const reviewGrowth =
    reviewsNow != null && reviewsBefore != null
      ? reviewsNow - reviewsBefore
      : null;
  const reviewsMax = Math.max(reviewsBefore ?? 0, reviewsNow ?? 0, 1);
  const fullStars = ratingNow != null ? Math.round(ratingNow) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            Opiniones de clientes, reseñas Google y seguimiento.
          </p>
        </div>
        {openNegative.length > 0 ? (
          <GradientButton
            type="button"
            onClick={() =>
              router.push('/campanas/nueva?objective=reactivate&from=feedback')
            }
          >
            Crear campaña de recuperación
          </GradientButton>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Satisfacción" value={pct(analytics.positiveRate)} />
        <Kpi label="Tasa respuesta" value={pct(analytics.responseRate)} />
        <Kpi label="A Google Maps" value={String(analytics.googleRedirects)} />
        <Kpi
          label="Alertas abiertas"
          value={String(analytics.openAlerts)}
          warn={analytics.openAlerts > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex h-full flex-col rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--onda-primary-100)]">
                <MapPin
                  className="h-5 w-5 text-[var(--onda-primary-500)]"
                  weight="duotone"
                  aria-hidden
                />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
                  Reputación en Google
                </h2>
                <p className="text-xs text-[var(--onda-muted)]">
                  Tu perfil de Maps desde que estás en Onda
                </p>
              </div>
            </div>
            {ratingDelta != null && ratingDelta > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--onda-success)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--onda-success)]">
                <TrendUp className="h-3.5 w-3.5" weight="bold" aria-hidden />
                +{ratingDelta.toFixed(1)} pts
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-bold leading-none text-[var(--onda-ink)]">
                  {ratingNow != null ? ratingNow.toFixed(1) : '—'}
                </span>
                <Star
                  className="h-5 w-5 text-amber-400"
                  weight="fill"
                  aria-hidden
                />
              </div>
              <div className="mt-2 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    weight={i < fullStars ? 'fill' : 'regular'}
                    aria-hidden
                    className={`h-4 w-4 ${
                      i < fullStars ? 'text-amber-400' : 'text-black/15'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--onda-muted)]">
                {reviewsNow != null
                  ? `${reviewsNow} reseñas en Google Maps`
                  : 'Sin datos de reseñas'}
              </p>
            </div>

            <div className="rounded-xl bg-black/[0.03] px-4 py-3 text-right">
              <p className="flex items-center justify-end gap-1 text-[11px] text-[var(--onda-muted)]">
                <ClockCounterClockwise className="h-3 w-3" aria-hidden />
                Al unirte a Onda
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 font-display text-xl font-bold text-[var(--onda-ink)]">
                {ratingBefore != null ? ratingBefore.toFixed(1) : '—'}
                <Star
                  className="h-3.5 w-3.5 text-black/20"
                  weight="fill"
                  aria-hidden
                />
              </p>
              <p className="text-[11px] text-[var(--onda-muted)]">
                {reviewsBefore != null
                  ? `${reviewsBefore} reseñas`
                  : 'Sin datos'}
              </p>
            </div>
          </div>

          {reviewsBefore != null && reviewsNow != null ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-10 shrink-0 text-[var(--onda-muted)]">
                  Antes
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-black/15"
                    style={{ width: `${(reviewsBefore / reviewsMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-[var(--onda-ink)]">
                  {reviewsBefore}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-10 shrink-0 text-[var(--onda-muted)]">
                  Hoy
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-[var(--onda-success)]"
                    style={{ width: `${(reviewsNow / reviewsMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-[var(--onda-ink)]">
                  {reviewsNow}
                </span>
              </div>
              {reviewGrowth != null && reviewGrowth > 0 ? (
                <p className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-[var(--onda-success)]">
                  <TrendUp className="h-3 w-3" weight="bold" aria-hidden />
                  +{reviewGrowth} reseñas nuevas desde que usas Onda
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2 border-t border-[var(--onda-border)] pt-4 text-xs text-[var(--onda-muted)]">
            <ChatCircleDots
              className="h-4 w-4 shrink-0 text-[var(--onda-primary-500)]"
              weight="duotone"
              aria-hidden
            />
            Feedback interno Onda: {analytics.total} respuestas en los últimos
            30 días.
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Respuestas por día
          </h2>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.series.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => String(v).slice(5).replace('-', '/')}
                  fontSize={11}
                />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="positive" name="Positivo" fill="var(--onda-success)" stackId="a" />
                <Bar dataKey="negative" name="Negativo" fill="var(--onda-danger)" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {dimChart.length > 0 ? (
          <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
              Aspectos más mencionados
            </h2>
            <div className="mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dimChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" name="Menciones" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <div
          className={`rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5 ${
            dimChart.length > 0 ? '' : 'lg:col-span-3'
          }`}
        >
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Análisis de sentimiento de comentarios
          </h2>
          <p className="mt-1 text-xs text-[var(--onda-muted)]">
            Clasificación automática con Google Cloud Natural Language
            {feedbacks.some((f) => f.sentimentScore == null)
              ? ' — solo comentarios con texto'
              : ''}
          </p>
          <ul className="mt-4 space-y-3">
          {sentimentDist.map(({ bucket, count, pctWidth }) => {
            const Icon = bucket.icon;
            return (
              <li key={bucket.id} className="flex items-center gap-2.5 text-sm">
                <Icon
                  className={`h-5 w-5 shrink-0 ${bucket.iconClass}`}
                  weight="duotone"
                  aria-hidden
                />
                <span className="w-20 shrink-0 text-[var(--onda-ink)]">
                  {bucket.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div
                    className={`h-full rounded-full transition-all ${bucket.barClass}`}
                    style={{ width: `${pctWidth}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-[var(--onda-ink)]">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      </div>

      {openNegative.length > 0 ? (
        <div className="rounded-2xl border border-[var(--onda-danger)]/30 bg-[var(--onda-danger)]/5 p-5">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Seguimiento — experiencias negativas
          </h2>
          <ul className="mt-3 space-y-3">
            {openNegative.slice(0, 5).map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--onda-card)] p-3"
              >
                <div>
                  <p className="font-medium text-[var(--onda-ink)]">
                    {f.user?.name || f.user?.phone || 'Cliente'}
                  </p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {f.dimensions
                      .map((id) => feedbackDimensionLabel(dims, id))
                      .join(' · ') || 'Sin detalle'}
                    {f.comment ? ` — “${f.comment.slice(0, 80)}”` : ''}
                  </p>
                  {f.followUpNote ? (
                    <p className="mt-1 flex items-start gap-1 text-xs italic text-[var(--onda-muted)]">
                      <ChatCircleDots className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      “{f.followUpNote.slice(0, 100)}”
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--onda-border)] px-3 py-1 text-xs font-medium"
                    onClick={() => setContactTarget(f)}
                  >
                    Contactar
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[var(--onda-success)] px-3 py-1 text-xs font-medium text-white"
                    onClick={() => setResolveTarget(f)}
                  >
                    Resolver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FollowUpModal
        kind="contact"
        target={contactTarget}
        busy={followUpBusy}
        quota={smsQuota}
        onClose={() => setContactTarget(null)}
        onSubmit={async (message) => {
          if (!contactTarget) return;
          await updateFollowUp(contactTarget.id, 'CONTACTED', { message });
          setContactTarget(null);
        }}
      />
      <FollowUpModal
        kind="resolve"
        target={resolveTarget}
        busy={followUpBusy}
        onClose={() => setResolveTarget(null)}
        onSubmit={async (note) => {
          if (!resolveTarget) return;
          await updateFollowUp(resolveTarget.id, 'RESOLVED', { note });
          setResolveTarget(null);
        }}
      />

      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--onda-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Todas las respuestas
          </h2>
          {feedbacks.length > 0 ? (
            <p className="text-xs text-[var(--onda-muted)]">
              {visibleFeedbacks.length} de {feedbacks.length} respuestas ·
              página {safePage} de {totalPages}
            </p>
          ) : null}
        </div>

        {feedbacks.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--onda-border)] px-5 py-3">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlass
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onda-muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por cliente o comentario…"
                className="w-full rounded-full border border-[var(--onda-border)] bg-transparent py-1.5 pl-9 pr-3 text-xs text-[var(--onda-ink)] outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-primary-500)]"
              />
            </div>
            <OndaSelect
              aria-label="Filtrar por experiencia"
              compact
              value={experienceFilter}
              onChange={setExperienceFilter}
              options={[
                { id: 'ALL', label: 'Todas las experiencias' },
                { id: 'POSITIVE', label: 'Positiva' },
                { id: 'NEGATIVE', label: 'Negativa' },
              ]}
            />
            <OndaSelect
              aria-label="Filtrar por estado"
              compact
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: 'ALL', label: 'Todos los estados' },
                { id: 'OPEN', label: 'Abierto' },
                { id: 'CONTACTED', label: 'Contactado' },
                { id: 'RESOLVED', label: 'Resuelto' },
              ]}
            />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[var(--onda-border)] text-left text-[var(--onda-muted)]">
                <th className="px-5 py-3 font-medium">
                  <SortHeader label="Cliente" sortKey="client" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">
                  <SortHeader label="Fecha" sortKey="date" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">
                  <SortHeader label="Experiencia" sortKey="experience" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">Aspectos</th>
                <th className="px-5 py-3 font-medium">Comentario</th>
                <th className="px-5 py-3 font-medium">
                  <SortHeader label="Análisis" sortKey="analysis" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">
                  <SortHeader label="Estado" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[var(--onda-muted)]">
                    Aún no hay feedback. Se envía SMS tras cada acumulación (PRO).
                  </td>
                </tr>
              ) : visibleFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[var(--onda-muted)]">
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                pageRows.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--onda-border)] last:border-0">
                    <td className="px-5 py-3">{f.user?.name || f.user?.phone}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--onda-muted)]">
                      {new Date(f.createdAt).toLocaleDateString('es', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          f.sentiment === 'POSITIVE'
                            ? 'text-[var(--onda-success)]'
                            : 'text-[var(--onda-danger)]'
                        }
                      >
                        {f.sentiment === 'POSITIVE' ? 'Positiva' : 'Negativa'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--onda-muted)]">
                      {f.dimensions
                        .map((id) => feedbackDimensionLabel(dims, id))
                        .join(', ') || '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-[var(--onda-muted)]">
                      {f.comment || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {sentimentTag(f.sentimentScore) || (
                        <span className="text-xs text-[var(--onda-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className="max-w-[160px] px-5 py-3 text-xs text-[var(--onda-muted)]"
                      title={f.followUpNote || undefined}
                    >
                      <span className="block">
                        {f.followUpStatus === 'OPEN'
                          ? 'Abierto'
                          : f.followUpStatus === 'CONTACTED'
                            ? 'Contactado'
                            : 'Resuelto'}
                        {f.redirectedToGoogle ? ' · Google' : ''}
                      </span>
                      {f.followUpNote ? (
                        <span className="mt-0.5 block truncate italic">
                          {f.followUpNote}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {visibleFeedbacks.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-[var(--onda-border)] px-5 py-3">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-full border border-[var(--onda-border)] px-3 py-1 text-xs font-medium disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded-full border border-[var(--onda-border)] px-3 py-1 text-xs font-medium disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SMS_TEMPLATES = [
  {
    id: 'apology',
    label: 'Disculpa',
    text: 'Hola {nombre}, somos el equipo de la tienda. Lamentamos lo ocurrido en tu última visita y ya estamos trabajando para mejorarlo. Gracias por tu honestidad.',
  },
  {
    id: 'gift',
    label: 'Compensación',
    text: 'Hola {nombre}, queremos compensarte por tu experiencia anterior. En tu próxima visita tienes un detalle especial por parte de la casa. ¡Te esperamos!',
  },
  {
    id: 'followup',
    label: 'Reinvitar',
    text: 'Hola {nombre}, ¿nos das otra oportunidad? Queremos que tu próxima experiencia sea muy diferente. Cuéntanos cuándo nos visitas y te recibimos como mereces.',
  },
];

const SMS_LIMIT = 480;

function FollowUpModal({
  kind,
  target,
  busy,
  quota,
  onClose,
  onSubmit,
}: {
  kind: 'contact' | 'resolve';
  target: FeedbackDto | null;
  busy: boolean;
  quota?: {
    reachUsed: number;
    reachLimit: number;
    freeRemaining: number;
    unitCop: number;
  } | null;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText('');
  }, [target]);

  if (!target) return null;

  const firstName = (target.user?.name || 'cliente').split(' ')[0];
  const isContact = kind === 'contact';

  async function handleSubmit() {
    try {
      await onSubmit(text.trim());
      setText('');
    } catch {
      // el toast del error ya lo muestra updateFollowUp
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isContact ? 'Contactar cliente' : 'Marcar como resuelto'}
      >
        <h3 className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          {isContact ? 'Contactar cliente' : 'Marcar como resuelto'}
        </h3>
        <p className="mt-1 text-xs text-[var(--onda-muted)]">
          {isContact
            ? `${target.user?.name || 'Cliente'} · ${target.user?.phone || 'sin teléfono'} — se envía por SMS`
            : `${target.user?.name || 'Cliente'} — quedará fuera de las alertas abiertas`}
        </p>

        {isContact ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SMS_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="rounded-full border border-[var(--onda-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--onda-ink)] hover:border-[var(--onda-primary-500)]"
                onClick={() => setText(t.text.replace('{nombre}', firstName))}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        {isContact && quota ? (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-[11px] ${
              quota.freeRemaining > 0
                ? 'bg-black/[0.03] text-[var(--onda-muted)]'
                : 'bg-amber-500/10 text-amber-700'
            }`}
          >
            Este mensaje descuenta de tu alcance: llevas {quota.reachUsed} de{' '}
            {quota.reachLimit} mensajes incluidos
            {quota.freeRemaining > 0 ? (
              <> · te quedan {quota.freeRemaining}</>
            ) : (
              <>
                {' '}
                · sin mensajes incluidos, se cobra ${quota.unitCop.toLocaleString(
                  'es-CO'
                )}{' '}
                como sobre-cupo de campaña
              </>
            )}
          </p>
        ) : null}

        <textarea
          className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-[var(--onda-border)] bg-transparent p-3 text-sm text-[var(--onda-ink)] outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-primary-500)]"
          placeholder={
            isContact
              ? 'Escribe el mensaje para el cliente…'
              : 'Opcional — ¿cómo quedó resuelto? Ej: Se ofreció postre de cortesía'
          }
          value={text}
          maxLength={SMS_LIMIT}
          onChange={(e) => setText(e.target.value)}
        />
        {isContact ? (
          <p className="mt-1 text-right text-[11px] text-[var(--onda-muted)]">
            {text.length}/{SMS_LIMIT}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--onda-border)] px-4 py-1.5 text-xs font-medium text-[var(--onda-ink)]"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
              isContact ? 'bg-[var(--onda-primary-500)]' : 'bg-[var(--onda-success)]'
            }`}
            disabled={busy || (isContact && !text.trim())}
            onClick={() => void handleSubmit()}
          >
            {busy
              ? 'Enviando…'
              : isContact
                ? 'Enviar SMS'
                : 'Confirmar resolución'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 ${
        isActive ? 'text-[var(--onda-ink)]' : 'hover:text-[var(--onda-ink)]'
      }`}
    >
      {label}
      {isActive ? (
        dir === 'asc' ? (
          <CaretUp className="h-3 w-3" weight="bold" aria-hidden />
        ) : (
          <CaretDown className="h-3 w-3" weight="bold" aria-hidden />
        )
      ) : (
        <CaretUp className="h-3 w-3 opacity-30" aria-hidden />
      )}
    </button>
  );
}

function Kpi({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warn
          ? 'border-[var(--onda-danger)]/30 bg-[var(--onda-danger)]/5'
          : 'border-[var(--onda-border)] bg-[var(--onda-card)]'
      }`}
    >
      <p className="text-xs font-medium text-[var(--onda-muted)]">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-[var(--onda-ink)]">
        {value}
      </p>
    </div>
  );
}
