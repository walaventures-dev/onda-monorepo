'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  GradientButton,
  api,
  toast,
  OndaIcons,
  SkeletonList,
} from '@onda/shared-ui';
import { PLAN_SMS_REACH_MONTHLY, SMS_OVERAGE_COP } from '@onda/shared-types';
import {
  formatCampaignRoi,
  formatCop,
  OBJECTIVE_TITLES,
  type ObjectiveKind,
} from '@onda/shared-utils';

type Recommendation = {
  id: string;
  objective: ObjectiveKind;
  reason: string;
  title: string;
  audienceCount: number;
  slowWindow?: string;
  cartillaId?: string;
};

type CampaignRow = {
  id: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED';
  origin: 'MANUAL' | 'RECOMMENDED';
  objective: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  sendSms: boolean;
  sendWallet: boolean;
  createdAt: string;
  audienceCount: number | null;
  reachCount: number | null;
  costCop: number;
  estimatedCostCop: number | null;
  successCount: number | null;
  roiRatio: number | null;
};

type CampaignsList = {
  campaigns: CampaignRow[];
  reachUsed: number;
  reachLimit: number;
  freeRemaining: number;
  unitCop: number;
  hasPaymentMethod: boolean;
};

type AnalyticsResponse = {
  kpis: {
    totalReach: number;
    avgSuccessRate: number;
    totalCost: number;
    totalAttributedSales: number;
    weightedRoi: number | null;
  };
  series: Array<{
    date: string;
    reach: number;
    successCount: number;
    costCop: number;
    attributedSalesCop: number;
    successRate: number;
    roi: number | null;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    objective: ObjectiveKind;
    sentAt: string | null;
    audienceCount: number | null;
    reachCount: number;
    successCount: number;
    successRate: number;
    worked: boolean;
    costCop: number;
    attributedSalesCop: number;
    roiRatio: number | null;
  }>;
};

const STATUS_LABEL: Record<CampaignRow['status'], string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  SENT: 'Enviada',
  CANCELLED: 'Cancelada',
  FAILED: 'Falló',
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CampaignsHome({
  storeId,
  confirm,
}: {
  storeId: string;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'default' | 'danger' | 'accent';
  }) => Promise<boolean>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [quota, setQuota] = useState<Omit<CampaignsList, 'campaigns'> | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [chartMode, setChartMode] = useState<'date' | 'campaign'>('date');

  const applyList = (list: CampaignsList) => {
    setCampaigns(list.campaigns || []);
    setQuota({
      reachUsed: list.reachUsed ?? 0,
      reachLimit: list.reachLimit ?? PLAN_SMS_REACH_MONTHLY.BASIC,
      freeRemaining: list.freeRemaining ?? 0,
      unitCop: list.unitCop ?? SMS_OVERAGE_COP,
      hasPaymentMethod: Boolean(list.hasPaymentMethod),
    });
  };

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date(Date.now() - 30 * 86400000);
      const [list, rec, an] = await Promise.all([
        api<CampaignsList>(`/campaigns?storeId=${storeId}`),
        api<{ recommendations: Recommendation[] }>(
          `/campaigns/recommendations?storeId=${storeId}`
        ),
        api<AnalyticsResponse>(
          `/campaigns/analytics?storeId=${storeId}&from=${isoDate(from)}&to=${isoDate(to)}`
        ),
      ]);
      applyList(list);
      setRecs(rec.recommendations || []);
      setAnalytics(an);
    } catch (e: any) {
      toast(e?.message || 'No se pudieron cargar las campañas');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelCampaign(id: string) {
    const ok = await confirm({
      title: '¿Cancelar esta campaña?',
      message: 'No se enviará SMS ni push si aún no salió.',
      confirmLabel: 'Cancelar envío',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/campaigns/${id}/cancel`, { method: 'POST' });
      toast('Campaña cancelada');
      await load();
    } catch (e: any) {
      toast(e?.message || 'No se pudo cancelar');
    }
  }

  const dateChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.series.map((s) => ({
      name: s.date.slice(5).replace('-', '/'),
      alcance: s.reach,
      costo: s.costCop,
      ventas: s.attributedSalesCop,
      exito: Math.round(s.successRate * 100),
    }));
  }, [analytics]);

  const campaignChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.campaigns.map((c) => ({
      name: c.title.length > 14 ? `${c.title.slice(0, 12)}…` : c.title,
      alcance: c.reachCount,
      costo: c.costCop,
      roi: c.roiRatio ?? 0,
    }));
  }, [analytics]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Campañas</h2>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            Objetivo → audiencia → revisión. El extra de SMS se cobra en la
            siguiente factura de consumos
            {quota
              ? ` · ${quota.reachUsed}/${quota.reachLimit} SMS usados · ${formatCop(quota.unitCop)}/SMS extra`
              : ''}
            {quota && !quota.hasPaymentMethod ? (
              <>
                {' '}
                ·{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => router.push('/facturacion')}
                >
                  Agrega tarjeta
                </button>
              </>
            ) : null}
          </p>
        </div>
        <GradientButton type="button" onClick={() => router.push('/campanas/nueva')}>
          {OndaIcons.plus} Nueva campaña
        </GradientButton>
      </header>

      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {analytics && analytics.campaigns.length > 0 ? (
            <section className="onda-card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-sm font-semibold">Resultados (30 días)</h3>
                <div className="flex gap-1 rounded-full bg-[var(--onda-bg)] p-1">
                  {(
                    [
                      { id: 'date' as const, label: 'Por fecha' },
                      { id: 'campaign' as const, label: 'Por campaña' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChartMode(opt.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        chartMode === opt.id
                          ? 'bg-white text-[var(--onda-ink)] shadow-sm'
                          : 'text-[var(--onda-muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Kpi label="Alcance" value={String(analytics.kpis.totalReach)} />
                <Kpi
                  label="Éxito medio"
                  value={`${Math.round(analytics.kpis.avgSuccessRate * 100)}%`}
                />
                <Kpi label="Costo total" value={formatCop(analytics.kpis.totalCost)} />
                <Kpi
                  label="Ventas atrib."
                  value={formatCop(analytics.kpis.totalAttributedSales)}
                />
                <Kpi
                  label="ROI medio"
                  value={formatCampaignRoi(analytics.kpis.weightedRoi)}
                />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'date' ? (
                    <ComposedChart data={dateChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--onda-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar yAxisId="left" dataKey="alcance" fill="#3DB9E8" radius={[4, 4, 0, 0]} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="exito"
                        stroke="#052DDE"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  ) : (
                    <BarChart data={campaignChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--onda-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="alcance" fill="#3DB9E8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Recomendadas para confirmar
            </h3>
            {recs.length === 0 ? (
              <p className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-5 text-sm text-[var(--onda-muted)]">
                Todavía no hay una sugerencia clara. Crea una campaña con el objetivo que
                quieras lograr.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recs.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/campanas/nueva?objective=${encodeURIComponent(r.objective)}&rec=${encodeURIComponent(r.id)}`
                      )
                    }
                    className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 text-left transition hover:border-[var(--onda-bridge)]"
                  >
                    <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
                      {r.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--onda-muted)]">
                      {r.reason}
                    </p>
                    <p className="mt-3 text-xs font-medium text-[var(--onda-primary-700)]">
                      {r.audienceCount} clientes · Revisar y confirmar →
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Historial
            </h3>
            {campaigns.length === 0 ? (
              <p className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-5 text-sm text-[var(--onda-muted)]">
                Aún no has lanzado campañas.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--onda-border)] overflow-hidden rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)]">
                {campaigns.map((c) => {
                  const obj = c.objective?.toLowerCase().replace('_hours', '_hours') as
                    | ObjectiveKind
                    | undefined;
                  const objectiveKey =
                    obj === 'slow_hours' ||
                    obj === 'reactivate' ||
                    obj === 'new_reward' ||
                    obj === 'reviews'
                      ? obj
                      : null;
                  return (
                    <li key={c.id}>
                      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--onda-bg)]/60">
                        <button
                          type="button"
                          onClick={() =>
                            c.status === 'SENT'
                              ? router.push(`/campanas/${c.id}`)
                              : undefined
                          }
                          disabled={c.status !== 'SENT'}
                          className="min-w-0 flex-1 text-left disabled:cursor-default"
                        >
                          <p className="truncate font-medium text-[var(--onda-ink)]">
                            {c.title}
                          </p>
                          <p className="text-xs text-[var(--onda-muted)]">
                            {objectiveKey ? OBJECTIVE_TITLES[objectiveKey] : 'Campaña'} ·{' '}
                            {STATUS_LABEL[c.status]}
                            {c.audienceCount != null && c.reachCount != null
                              ? ` · Alcance ${c.audienceCount}→${c.reachCount}`
                              : c.audienceCount != null
                                ? ` · Est. ${c.audienceCount}`
                                : ''}
                            {c.status === 'SENT' && c.costCop != null
                              ? ` · ${formatCop(c.costCop)}`
                              : ''}
                            {c.status === 'SENT' && c.roiRatio != null
                              ? ` · ROI ${formatCampaignRoi(c.roiRatio)}`
                              : ''}
                          </p>
                        </button>
                        {c.status === 'SCHEDULED' ? (
                          <button
                            type="button"
                            onClick={() => void cancelCampaign(c.id)}
                            className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--onda-danger)] hover:bg-[var(--onda-danger)]/8"
                          >
                            Cancelar
                          </button>
                        ) : c.status === 'SENT' ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/campanas/${c.id}`)}
                            className="text-xs text-[var(--onda-primary-700)]"
                          >
                            Ver →
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
