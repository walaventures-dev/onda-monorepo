'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, SkeletonDetail, toast } from '@onda/shared-ui';
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

  if (loading || !data) {
    return <SkeletonDetail />;
  }

  const { campaign, configuration, metrics } = data;
  const unitCop =
    metrics && metrics.paidReachCount && metrics.paidReachCount > 0
      ? Math.round(metrics.costCop / metrics.paidReachCount)
      : 200;
  const reachDelta =
    campaign.audienceCount != null &&
    campaign.reachCount != null &&
    campaign.reachCount < campaign.audienceCount;

  const funnelChart =
    metrics && metrics.reachCount > 0
      ? [
          { etapa: 'Alcance', valor: metrics.reachCount },
          { etapa: 'Éxito', valor: metrics.successCount },
          {
            etapa: 'Ventas',
            valor: metrics.attributedSalesCop > 0 ? metrics.successCount : 0,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
        >
          ← Campañas
        </button>
        <div className="text-right">
          <h2 className="font-display text-2xl font-semibold">{campaign.title}</h2>
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

      <section className="onda-card space-y-4 p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
          Configuración de la campaña
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-[var(--onda-muted)]">Objetivo</dt>
            <dd className="font-medium">{configuration.objectiveLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--onda-muted)]">Programación</dt>
            <dd>
              {campaign.sentAt
                ? 'Enviada'
                : campaign.scheduledAt
                  ? new Date(campaign.scheduledAt).toLocaleString('es-CO')
                  : 'Ahora'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--onda-muted)]">Canales</dt>
            <dd>
              {[configuration.sendWallet && 'Wallet', configuration.sendSms && 'SMS']
                .filter(Boolean)
                .join(' · ') || '—'}
            </dd>
          </div>
        </dl>
        {configuration.smsBody || configuration.walletBody ? (
          <ul className="space-y-2 border-t border-[var(--onda-border)] pt-4">
            {configuration.walletBody ? (
              <li className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-sm">
                <span className="text-[10px] font-semibold uppercase text-[var(--onda-muted)]">
                  Wallet
                </span>
                <p className="mt-1">{configuration.walletBody}</p>
              </li>
            ) : null}
            {configuration.smsBody ? (
              <li className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-sm">
                <span className="text-[10px] font-semibold uppercase text-[var(--onda-muted)]">
                  SMS
                </span>
                <p className="mt-1">{configuration.smsBody}</p>
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {metrics ? (
        <>
          <section className="onda-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">Esperado vs real</h3>
              {reachDelta ? (
                <span className="rounded-full bg-[var(--onda-warning)]/15 px-2.5 py-1 text-xs font-medium text-[var(--onda-ink)]">
                  Alcance menor al estimado
                </span>
              ) : null}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  metrics.worked
                    ? 'bg-[var(--onda-success)]/15 text-[var(--onda-success)]'
                    : 'bg-[var(--onda-muted)]/15 text-[var(--onda-muted)]'
                }`}
              >
                {metrics.worked ? '✓ Funcionó' : '✗ Por debajo del umbral'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCompare
                label="Alcance"
                expected={campaign.audienceCount}
                actual={metrics.reachCount}
              />
              <div className="rounded-xl border border-[var(--onda-border)] p-3">
                <p className="text-xs text-[var(--onda-muted)]">{metrics.successLabel}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {metrics.successCount}
                </p>
                <p className="text-xs text-[var(--onda-muted)]">
                  {Math.round(metrics.successRate * 100)}% del alcance
                </p>
              </div>
              <MetricCompare
                label="Costo (COP)"
                expected={metrics.estimatedCostCop}
                actual={metrics.costCop}
                format={formatCop}
              />
            </div>
          </section>

          <section className="onda-card space-y-3 p-5">
            <h3 className="font-display text-sm font-semibold">Costo de la campaña (real)</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Personas alcanzadas" value={String(metrics.reachCount)} />
              <Row
                label="Gratis aplicadas (mes)"
                value={String(metrics.freeReachApplied ?? 0)}
              />
              {(metrics.paidReachCount ?? 0) > 0 ? (
                <Row
                  label="Personas de pago"
                  value={`${metrics.paidReachCount} × ${formatCop(unitCop)}`}
                />
              ) : null}
              <Row label="Costo total" value={formatCop(metrics.costCop)} bold />
            </dl>
          </section>

          <section className="onda-card space-y-3 p-5">
            <h3 className="font-display text-sm font-semibold">Retorno de inversión</h3>
            <dl className="space-y-2 text-sm">
              <Row
                label="Ventas atribuidas"
                value={formatCop(metrics.attributedSalesCop)}
              />
              <Row label="Costo campaña" value={formatCop(metrics.costCop)} />
              <Row
                label="ROI"
                value={formatCampaignRoi(metrics.roiRatio)}
                bold
              />
            </dl>
            {metrics.costCop > 0 && metrics.attributedSalesCop > 0 ? (
              <p className="text-xs text-[var(--onda-muted)]">
                Por cada $1 invertido en alcance, generaste{' '}
                {formatCampaignRoi(metrics.roiRatio)} en ventas atribuidas.
              </p>
            ) : metrics.objective === 'reviews' ? (
              <p className="text-xs text-[var(--onda-muted)]">
                El retorno principal es reputación ({metrics.successCount} reseñas), no ventas
                directas.
              </p>
            ) : (
              <p className="text-xs text-[var(--onda-muted)]">
                Aún no hay ventas atribuidas en la ventana de medición.
              </p>
            )}
          </section>

          {funnelChart.length > 0 ? (
            <section className="onda-card p-5">
              <h3 className="font-display text-sm font-semibold">Conversión</h3>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChart}>
                    <XAxis dataKey="etapa" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="valor" fill="var(--onda-primary-500)" radius={[6, 6, 0, 0]} />
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
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--onda-muted)]">{label}</dt>
      <dd className={bold ? 'font-semibold text-[var(--onda-ink)]' : ''}>{value}</dd>
    </div>
  );
}

function MetricCompare({
  label,
  expected,
  actual,
  format = (n: number) => String(n),
}: {
  label: string;
  expected: number | null | undefined;
  actual: number | null | undefined;
  format?: (n: number) => string;
}) {
  const exp = expected ?? 0;
  const act = actual ?? 0;
  const delta = exp > 0 ? Math.round(((act - exp) / exp) * 100) : null;
  return (
    <div className="rounded-xl border border-[var(--onda-border)] p-3">
      <p className="text-xs text-[var(--onda-muted)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--onda-muted)]">
        Estimado: {expected != null ? format(exp) : '—'}
      </p>
      <p className="font-display text-2xl font-bold">{format(act)}</p>
      {delta != null && delta !== 0 ? (
        <p className="text-xs text-[var(--onda-muted)]">{delta > 0 ? '+' : ''}{delta}% vs estimado</p>
      ) : null}
    </div>
  );
}
