'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UsersThreeIcon as UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { ChartLineUpIcon as ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { CurrencyCircleDollarIcon as CurrencyCircleDollar } from '@phosphor-icons/react/dist/csr/CurrencyCircleDollar';
import { TrendUpIcon as TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { api, KpiCard, SkeletonDetail, toast } from '@onda/shared-ui';
import {
  formatCampaignRoi,
  formatCop,
  OBJECTIVE_TITLES,
  type ObjectiveKind,
} from '@onda/shared-utils';

type CampaignResults = {
  campaign: {
    id: string;
    title: string;
    status: string;
    sentAt: string | null;
    scheduledAt: string | null;
    smsBody: string | null;
    walletBody: string | null;
    sendSms: boolean;
    sendWallet: boolean;
    audienceCount: number | null;
    reachCount: number | null;
    estimatedCostCop: number | null;
    costCop: number;
    freeReachApplied: number | null;
    paidReachCount: number | null;
    successCount: number | null;
    attributedSalesCop: number | null;
    roiRatio: number | null;
  };
  configuration: {
    objective: ObjectiveKind;
    objectiveLabel: string;
    filter: Record<string, unknown>;
    smsBody: string | null;
    walletBody: string | null;
    sendSms: boolean;
    sendWallet: boolean;
    scheduledAt: string | null;
    sentAt: string | null;
  };
  metrics: {
    reachCount: number;
    audienceCount: number | null;
    successCount: number;
    successRate: number;
    worked: boolean;
    successLabel: string;
    attributedSalesCop: number;
    costCop: number;
    estimatedCostCop: number | null;
    roiRatio: number | null;
    freeReachApplied: number | null;
    paidReachCount: number | null;
    objective: ObjectiveKind;
  } | null;
};

export function CampaignDetail({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<CampaignResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    void api<CampaignResults>(`/campaigns/${campaignId}/results`)
      .then(setData)
      .catch((e: any) => {
        toast(e?.message || 'No se pudieron cargar los resultados');
        router.push('/campanas');
      })
      .finally(() => setLoading(false));
  }, [campaignId, router]);

  const funnelChart = useMemo(() => {
    if (!data?.metrics || data.metrics.reachCount <= 0) return [];
    const m = data.metrics;
    return [
      { etapa: 'Alcance', valor: m.reachCount, fill: '#3DB9E8' },
      { etapa: 'Éxito', valor: m.successCount, fill: '#052DDE' },
      {
        etapa: 'Con venta',
        valor: m.attributedSalesCop > 0 ? m.successCount : 0,
        fill: '#2BB673',
      },
    ];
  }, [data?.metrics]);

  if (loading || !data) {
    return <SkeletonDetail />;
  }

  const { campaign, configuration, metrics } = data;
  const unitCop =
    metrics && metrics.paidReachCount && metrics.paidReachCount > 0
      ? Math.round(metrics.costCop / metrics.paidReachCount)
      : 200;
  const freeApplied = metrics?.freeReachApplied ?? 0;
  const paidCount = metrics?.paidReachCount ?? 0;
  const reachExpected = metrics?.audienceCount ?? campaign.audienceCount ?? 0;
  const reachActual = metrics?.reachCount ?? 0;
  const successPct = metrics ? Math.round(metrics.successRate * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
        >
          ← Campañas
        </button>
        <div className="text-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {metrics ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  metrics.worked
                    ? 'bg-[var(--onda-success)]/15 text-[var(--onda-success)]'
                    : 'bg-[var(--onda-muted)]/15 text-[var(--onda-muted)]'
                }`}
              >
                {metrics.worked ? '✓ Funcionó' : 'En evaluación'}
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold">{campaign.title}</h2>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            {OBJECTIVE_TITLES[configuration.objective]}
            {campaign.sentAt
              ? ` · ${new Date(campaign.sentAt).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}`
              : ''}
          </p>
        </div>
      </header>

      {metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Personas alcanzadas"
              value={reachActual}
              hint={
                reachExpected > 0
                  ? `Estimaste ${reachExpected}`
                  : undefined
              }
              icon={<UsersThree weight="duotone" />}
              tone="sky"
            />
            <KpiCard
              label={metrics.successLabel}
              value={metrics.successCount}
              hint={`${successPct}% del alcance`}
              icon={<ChartLineUp weight="duotone" />}
              tone="primary"
            />
            <KpiCard
              label="Costo de alcance"
              value={formatCop(metrics.costCop)}
              hint={
                paidCount > 0
                  ? `${paidCount} de pago · ${freeApplied} gratis`
                  : freeApplied > 0
                    ? '100% cupo gratis'
                    : 'Sin costo'
              }
              icon={<CurrencyCircleDollar weight="duotone" />}
              tone="amber"
            />
            <KpiCard
              label="ROI"
              value={formatCampaignRoi(metrics.roiRatio)}
              hint={
                metrics.attributedSalesCop > 0
                  ? `${formatCop(metrics.attributedSalesCop)} en ventas`
                  : metrics.objective === 'reviews'
                    ? `${metrics.successCount} reseñas`
                    : 'Sin ventas aún'
              }
              icon={<TrendUp weight="duotone" />}
              tone="success"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="onda-card space-y-5 p-5">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                  ¿A cuántos llegó?
                </h3>
                <p className="mt-1 text-xs text-[var(--onda-muted)]">
                  Comparación entre lo que estimaste al lanzar y lo que realmente contactamos.
                </p>
              </div>
              <ReachCompareBar expected={reachExpected} actual={reachActual} />
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-[var(--onda-bg)] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                    Estimado
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                    {reachExpected || '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--onda-primary-50)] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
                    Real
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--onda-primary-700)]">
                    {reachActual}
                  </p>
                </div>
              </div>
              <SuccessMeter
                label={metrics.successLabel}
                count={metrics.successCount}
                total={reachActual}
                pct={successPct}
              />
            </section>

            <section className="onda-card space-y-5 p-5">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                  ¿Cuánto costó y qué dejó?
                </h3>
                <p className="mt-1 text-xs text-[var(--onda-muted)]">
                  Desglose del alcance y retorno en ventas atribuidas.
                </p>
              </div>

              <CostStackBar
                free={freeApplied}
                paid={paidCount}
                total={reachActual}
                unitCop={unitCop}
                costCop={metrics.costCop}
              />

              <InvestmentChart
                costCop={metrics.costCop}
                salesCop={metrics.attributedSalesCop}
              />

              <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                  Retorno
                </p>
                <p className="mt-1 font-display text-4xl font-bold text-[var(--onda-ink)]">
                  {formatCampaignRoi(metrics.roiRatio)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--onda-muted)]">
                  {metrics.costCop > 0 && metrics.attributedSalesCop > 0 ? (
                    <>
                      Por cada <strong className="text-[var(--onda-ink)]">$1</strong> en alcance
                      generaste{' '}
                      <strong className="text-[var(--onda-ink)]">
                        {formatCampaignRoi(metrics.roiRatio)}
                      </strong>{' '}
                      en ventas.
                    </>
                  ) : metrics.objective === 'reviews' ? (
                    <>El valor principal son {metrics.successCount} reseñas, no ventas directas.</>
                  ) : metrics.costCop === 0 ? (
                    <>Campaña 100% gratis — el ROI en ventas aparece cuando haya compras atribuidas.</>
                  ) : (
                    <>Aún no hay ventas atribuidas en la ventana de medición.</>
                  )}
                </p>
              </div>
            </section>
          </div>

          {funnelChart.length > 0 ? (
            <section className="onda-card p-5">
              <h3 className="font-display text-sm font-semibold">Embudo de la campaña</h3>
              <p className="mt-1 text-xs text-[var(--onda-muted)]">
                De personas contactadas a conversiones y ventas atribuidas.
              </p>
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip
                      cursor={{ fill: 'rgba(5,45,222,0.06)' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--onda-border)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="valor" name="Personas" radius={[8, 8, 0, 0]}>
                      {funnelChart.map((entry) => (
                        <Cell key={entry.etapa} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="onda-card p-5 text-sm text-[var(--onda-muted)]">
          Los resultados aparecen cuando la campaña se envía.
        </p>
      )}

      <section className="onda-card overflow-hidden">
        <button
          type="button"
          onClick={() => setConfigOpen((o) => !o)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="font-display text-sm font-semibold text-[var(--onda-ink)]">
            Lo que configuraste
          </span>
          <span className="text-xs text-[var(--onda-muted)]">{configOpen ? 'Ocultar' : 'Ver'}</span>
        </button>
        {configOpen ? (
          <div className="space-y-4 border-t border-[var(--onda-border)] px-5 pb-5 pt-4">
            <p className="text-sm font-medium">{configuration.objectiveLabel}</p>
            <p className="text-xs text-[var(--onda-muted)]">
              {[configuration.sendWallet && 'Wallet', configuration.sendSms && 'SMS']
                .filter(Boolean)
                .join(' · ')}
            </p>
            {configuration.walletBody ? (
              <MessageBubble channel="Wallet" text={configuration.walletBody} />
            ) : null}
            {configuration.smsBody ? (
              <MessageBubble channel="SMS" text={configuration.smsBody} />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ReachCompareBar({ expected, actual }: { expected: number; actual: number }) {
  const max = Math.max(expected, actual, 1);
  const expectedPct = expected > 0 ? (expected / max) * 100 : 0;
  const actualPct = (actual / max) * 100;

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-[10px] font-medium text-[var(--onda-muted)]">
          <span>Estimado al lanzar</span>
          <span>{expected || 0}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--onda-bg)]">
          <div
            className="h-full rounded-full bg-[var(--onda-border)] transition-all"
            style={{ width: `${expectedPct}%` }}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] font-medium text-[var(--onda-primary-700)]">
          <span>Alcance real</span>
          <span>{actual}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--onda-primary-50)]">
          <div
            className="h-full rounded-full bg-[var(--onda-primary-500)] transition-all"
            style={{ width: `${actualPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SuccessMeter({
  label,
  count,
  total,
  pct,
}: {
  label: string;
  count: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--onda-border)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--onda-muted)]">{label}</p>
        <p className="font-display text-lg font-bold tabular-nums">
          {count}
          <span className="text-sm font-normal text-[var(--onda-muted)]"> / {total || 0}</span>
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--onda-bg)]">
        <div
          className="h-full rounded-full bg-[var(--onda-success)] transition-all"
          style={{ width: `${Math.min(100, total > 0 ? pct : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[var(--onda-muted)]">{pct}% respondió al objetivo</p>
    </div>
  );
}

function CostStackBar({
  free,
  paid,
  total,
  unitCop,
  costCop,
}: {
  free: number;
  paid: number;
  total: number;
  unitCop: number;
  costCop: number;
}) {
  if (total <= 0) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">Sin personas alcanzadas en el envío.</p>
    );
  }
  const freePct = (free / total) * 100;
  const paidPct = (paid / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex h-8 overflow-hidden rounded-xl">
        {free > 0 ? (
          <div
            className="flex items-center justify-center bg-[var(--onda-success)]/20 text-[10px] font-semibold text-[var(--onda-success)]"
            style={{ width: `${freePct}%` }}
            title={`${free} gratis`}
          >
            {freePct >= 18 ? `${free} gratis` : ''}
          </div>
        ) : null}
        {paid > 0 ? (
          <div
            className="flex items-center justify-center bg-[#F5A524]/25 text-[10px] font-semibold text-[var(--onda-ink)]"
            style={{ width: `${paidPct}%` }}
            title={`${paid} de pago`}
          >
            {paidPct >= 18 ? `${paid} × ${formatCop(unitCop)}` : ''}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <LegendDot color="var(--onda-success)" label={`${free} cupo gratis`} />
        {paid > 0 ? (
          <LegendDot color="#F5A524" label={`${paid} de pago (${formatCop(unitCop)} c/u)`} />
        ) : null}
        <span className="ml-auto font-semibold tabular-nums text-[var(--onda-ink)]">
          Total {formatCop(costCop)}
        </span>
      </div>
    </div>
  );
}

function InvestmentChart({
  costCop,
  salesCop,
}: {
  costCop: number;
  salesCop: number;
}) {
  const data = [
    { name: 'Costo', monto: costCop, fill: '#F5A524' },
    { name: 'Ventas', monto: salesCop, fill: '#2BB673' },
  ];
  const max = Math.max(costCop, salesCop, 1);

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
        Costo vs ventas atribuidas
      </p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
          >
            <XAxis type="number" hide domain={[0, max * 1.15]} />
            <YAxis type="category" dataKey="name" width={52} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) => formatCop(Number(v ?? 0))}
              cursor={{ fill: 'rgba(5,45,222,0.04)' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid var(--onda-border)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="monto" radius={[0, 6, 6, 0]} barSize={22}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--onda-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MessageBubble({ channel, text }: { channel: string; text: string }) {
  return (
    <div className="rounded-xl bg-[var(--onda-bg)] px-3 py-2.5 text-sm">
      <span className="text-[10px] font-semibold uppercase text-[var(--onda-muted)]">
        {channel}
      </span>
      <p className="mt-1 leading-snug">{text}</p>
    </div>
  );
}
