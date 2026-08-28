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
  api,
  GradientButton,
  SkeletonDashboard,
  toast,
} from '@onda/shared-ui';
import type { FeedbackAnalyticsDto, FeedbackDto } from '@onda/shared-types';
import { feedbackDimensionLabel, feedbackDimensionsFor } from '@onda/shared-utils';
import { useStoreSse } from '../lib/useStoreSse';

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

  const dims = useMemo(
    () =>
      subcategory
        ? feedbackDimensionsFor(subcategory, segment)
        : [],
    [subcategory, segment]
  );

  const load = useCallback(async (silent = false) => {
    if (planType !== 'PRO') {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
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

  useStoreSse(storeId, planType === 'PRO', (payload) => {
    if (payload.kind !== 'feedback_new' && payload.kind !== 'feedback_alert') {
      return;
    }
    void load(true);
  });

  async function updateFollowUp(
    feedbackId: string,
    status: 'OPEN' | 'CONTACTED' | 'RESOLVED'
  ) {
    try {
      await api(`/feedback/${feedbackId}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId, status }),
      });
      toast('Seguimiento actualizado');
      void load(true);
    } catch (err: any) {
      toast(err.message || 'No se pudo actualizar');
    }
  }

  if (planType !== 'PRO') {
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

  return (
    <div className="space-y-6">
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
        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Google: antes y después de Onda
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--onda-muted)]">Al unirte</p>
              <p className="mt-1 text-lg font-bold text-[var(--onda-ink)]">
                {analytics.googleDelta.ratingBefore != null
                  ? `★ ${analytics.googleDelta.ratingBefore.toFixed(1)}`
                  : '—'}
              </p>
              <p className="text-xs text-[var(--onda-muted)]">
                {analytics.googleDelta.reviewsBefore != null
                  ? `${analytics.googleDelta.reviewsBefore} reseñas`
                  : 'Sin datos'}
              </p>
            </div>
            <div>
              <p className="text-[var(--onda-muted)]">Hoy</p>
              <p className="mt-1 text-lg font-bold text-[var(--onda-ink)]">
                {analytics.googleDelta.ratingNow != null
                  ? `★ ${analytics.googleDelta.ratingNow.toFixed(1)}`
                  : '—'}
              </p>
              <p className="text-xs text-[var(--onda-muted)]">
                {analytics.googleDelta.reviewsNow != null
                  ? `${analytics.googleDelta.reviewsNow} reseñas`
                  : 'Sin datos'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--onda-muted)]">
            Feedback interno Onda: {analytics.total} respuestas en 30 días.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Respuestas por día
          </h2>
          <div className="mt-4 h-48">
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

      {dimChart.length > 0 ? (
        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Aspectos más mencionados
          </h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dimChart} layout="vertical">
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
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--onda-border)] px-3 py-1 text-xs font-medium"
                    onClick={() => void updateFollowUp(f.id, 'CONTACTED')}
                  >
                    Contactado
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[var(--onda-success)] px-3 py-1 text-xs font-medium text-white"
                    onClick={() => void updateFollowUp(f.id, 'RESOLVED')}
                  >
                    Resuelto
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] overflow-hidden">
        <div className="border-b border-[var(--onda-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--onda-ink)]">
            Todas las respuestas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--onda-border)] text-left text-[var(--onda-muted)]">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Experiencia</th>
                <th className="px-5 py-3 font-medium">Aspectos</th>
                <th className="px-5 py-3 font-medium">Comentario</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--onda-muted)]">
                    Aún no hay feedback. Se envía SMS tras cada acumulación (PRO).
                  </td>
                </tr>
              ) : (
                feedbacks.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--onda-border)] last:border-0">
                    <td className="px-5 py-3">{f.user?.name || f.user?.phone}</td>
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
                    <td className="px-5 py-3 text-xs text-[var(--onda-muted)]">
                      {f.followUpStatus === 'OPEN'
                        ? 'Abierto'
                        : f.followUpStatus === 'CONTACTED'
                          ? 'Contactado'
                          : 'Resuelto'}
                      {f.redirectedToGoogle ? ' · Google' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
