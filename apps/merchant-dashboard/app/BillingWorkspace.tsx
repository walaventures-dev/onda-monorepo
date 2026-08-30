'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadSimpleIcon as Download } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { api, toast } from '@onda/shared-ui';
import {
  formatChargeDate,
  formatCop,
  PLAN_META,
  type PlanId,
} from '@onda/shared-utils';

type BillingSummary = {
  planType: PlanId;
  billingStatus: string;
  billingPeriod: string;
  nextBillingAt: string | null;
  nextUsageBillingAt: string | null;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  newCustomersUsed: number;
  newCustomersLimit: number;
  extraCustomers: number;
  extraCustomersCop: number;
  smsUsed: number;
  smsLimit: number;
  extraSms: number;
  extraSmsCop: number;
  campaignsCount: number;
  usageProjectedCop: number;
  carriedBalanceCop: number;
  planPriceCop: number;
  issuer?: { legalName: string; website: string; nit: string };
};

type InvoiceRow = {
  id: string;
  kind: 'PLAN' | 'USAGE' | 'COMBINED';
  status: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalCop: number;
  chargedCop: number;
  issuedAt: string;
  extraCustomersCount: number;
  extraSmsCount: number;
  campaignsCount: number;
};

type UsageBreakdown = {
  newCustomersUsed: number;
  extraCustomers: number;
  extraCustomersCop: number;
  smsUsed: number;
  extraSms: number;
  extraSmsCop: number;
  projectedCop: number;
  campaigns: Array<{
    id: string;
    title: string;
    sentAt: string | null;
    smsReachCount: number | null;
    reachCount: number | null;
    costCop: number;
  }>;
};

const KIND_LABEL: Record<InvoiceRow['kind'], string> = {
  PLAN: 'Plan',
  USAGE: 'Consumos',
  COMBINED: 'Plan + consumos',
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pagado',
  ZERO: 'Sin cargo',
  ISSUED: 'Emitido',
  FAILED: 'Falló el cobro',
  CARRIED: 'Saldo al siguiente mes',
};

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function BillingWorkspace({ storeId }: { storeId: string }) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [usage, setUsage] = useState<UsageBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `from=${from}T00:00:00.000Z&to=${to}T23:59:59.999Z`;
      const [s, inv, u] = await Promise.all([
        api<BillingSummary>(`/billing/store/${storeId}`),
        api<InvoiceRow[]>(`/billing/store/${storeId}/invoices?${qs}`),
        api<UsageBreakdown>(`/billing/store/${storeId}/usage?${qs}`),
      ]);
      setSummary(s);
      setInvoices(inv);
      setUsage(u);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar facturación');
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const planName = summary ? PLAN_META[summary.planType].name : '—';

  const meters = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Clientes nuevos',
        used: summary.newCustomersUsed,
        limit: summary.newCustomersLimit,
        extra: summary.extraCustomers,
        extraCop: summary.extraCustomersCop,
      },
      {
        label: 'SMS de campañas',
        used: summary.smsUsed,
        limit: summary.smsLimit,
        extra: summary.extraSms,
        extraCop: summary.extraSmsCop,
      },
    ];
  }, [summary]);

  function downloadPdf(id: string) {
    window.open(`/api/billing/store/${storeId}/invoices/${id}/pdf`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
          Facturación
        </h1>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          Recibos del plan y de consumos adicionales. Emite{' '}
          {summary?.issuer?.legalName || 'Wala Ventures S.A.S'}.
        </p>
      </div>

      {loading && !summary ? (
        <div className="onda-card h-40 animate-pulse bg-[var(--onda-bg)]" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="onda-card space-y-3 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                Plan actual
              </p>
              <p className="font-display text-xl font-semibold text-[var(--onda-ink)]">
                {planName}
              </p>
              <p className="text-sm text-[var(--onda-muted)]">
                {formatCop(summary?.planPriceCop ?? 0)} / mes ·{' '}
                {summary?.billingStatus === 'ACTIVE' ? 'Activo' : summary?.billingStatus}
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--onda-muted)]">Corte del plan</dt>
                  <dd className="tabular-nums">
                    {summary?.nextBillingAt
                      ? formatChargeDate(new Date(summary.nextBillingAt))
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--onda-muted)]">Corte de consumos</dt>
                  <dd className="tabular-nums">
                    {summary?.nextUsageBillingAt
                      ? formatChargeDate(new Date(summary.nextUsageBillingAt))
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="onda-card space-y-4 p-5 lg:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                    Periodo actual de consumos
                  </p>
                  <p className="mt-1 text-sm text-[var(--onda-muted)]">
                    {summary
                      ? `${formatChargeDate(new Date(summary.usagePeriodStart))} – ${formatChargeDate(new Date(summary.usagePeriodEnd))}`
                      : '—'}
                  </p>
                </div>
                <p className="font-display text-2xl font-semibold text-[var(--onda-primary-500)]">
                  {formatCop(summary?.usageProjectedCop ?? 0)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {meters.map((m) => {
                  const pct = Math.min(
                    100,
                    Math.round((m.used / Math.max(1, m.limit)) * 100)
                  );
                  return (
                    <div key={m.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-[var(--onda-ink)]">{m.label}</span>
                        <span className="tabular-nums text-[var(--onda-muted)]">
                          {m.used}/{m.limit}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--onda-bg)]">
                        <div
                          className="h-full rounded-full bg-[var(--onda-primary-500)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {m.extra > 0 ? (
                        <p className="mt-1 text-xs text-[var(--onda-muted)]">
                          {m.extra} extra · {formatCop(m.extraCop)} en la próxima
                          factura
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--onda-muted)]">
                          Dentro del cupo del plan
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {summary && summary.carriedBalanceCop > 0 ? (
                <p className="text-xs text-[var(--onda-muted)]">
                  Saldo arrastrado: {formatCop(summary.carriedBalanceCop)}
                </p>
              ) : null}
              <p className="text-xs text-[var(--onda-muted)]">
                Campañas enviadas este periodo: {summary?.campaignsCount ?? 0}.
                Extra de clientes $500, extra de SMS $150. Se cobran en el corte
                de consumos, no al enviar.
              </p>
            </div>
          </div>

          <div className="onda-card space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
                  Recibos y consumos
                </h2>
                <p className="mt-0.5 text-xs text-[var(--onda-muted)]">
                  Filtra por fechas para ver meses facturados y el detalle de
                  campañas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-[var(--onda-muted)]">
                  Desde
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="ml-2 rounded-full border border-[var(--onda-border)] bg-white px-3 py-1.5 text-sm text-[var(--onda-ink)]"
                  />
                </label>
                <label className="text-xs text-[var(--onda-muted)]">
                  Hasta
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="ml-2 rounded-full border border-[var(--onda-border)] bg-white px-3 py-1.5 text-sm text-[var(--onda-ink)]"
                  />
                </label>
              </div>
            </div>

            {usage ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniKpi
                  label="Clientes nuevos"
                  value={`${usage.newCustomersUsed}`}
                  hint={
                    usage.extraCustomers > 0
                      ? `${usage.extraCustomers} extra · ${formatCop(usage.extraCustomersCop)}`
                      : 'Sin extras'
                  }
                />
                <MiniKpi
                  label="SMS"
                  value={`${usage.smsUsed}`}
                  hint={
                    usage.extraSms > 0
                      ? `${usage.extraSms} extra · ${formatCop(usage.extraSmsCop)}`
                      : 'Sin extras'
                  }
                />
                <MiniKpi
                  label="Proyección extras"
                  value={formatCop(usage.projectedCop)}
                  hint={`${usage.campaigns.length} campañas`}
                />
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
                    <th className="pb-2 pr-3 font-semibold">Recibo</th>
                    <th className="pb-2 pr-3 font-semibold">Periodo</th>
                    <th className="pb-2 pr-3 font-semibold">Tipo</th>
                    <th className="pb-2 pr-3 font-semibold">Estado</th>
                    <th className="pb-2 pr-3 font-semibold">Total</th>
                    <th className="pb-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-[var(--onda-muted)]"
                      >
                        Aún no hay recibos en este rango.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t border-[var(--onda-border)]"
                      >
                        <td className="py-3 pr-3 font-medium text-[var(--onda-ink)]">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 pr-3 text-[var(--onda-muted)]">
                          {formatChargeDate(new Date(inv.periodStart))} –{' '}
                          {formatChargeDate(new Date(inv.periodEnd))}
                        </td>
                        <td className="py-3 pr-3">{KIND_LABEL[inv.kind]}</td>
                        <td className="py-3 pr-3">
                          {STATUS_LABEL[inv.status] || inv.status}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {formatCop(inv.totalCop)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadPdf(inv.id)}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--onda-primary-500)] hover:bg-[var(--onda-primary-50)]"
                          >
                            <Download size={14} />
                            Descargar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {usage && usage.campaigns.length > 0 ? (
              <div>
                <h3 className="mb-2 font-display text-sm font-semibold">
                  Campañas en el rango
                </h3>
                <ul className="divide-y divide-[var(--onda-border)]">
                  {usage.campaigns.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span className="font-medium text-[var(--onda-ink)]">
                        {c.title}
                      </span>
                      <span className="text-[var(--onda-muted)]">
                        {c.sentAt
                          ? formatChargeDate(new Date(c.sentAt))
                          : '—'}{' '}
                        · {c.smsReachCount ?? c.reachCount ?? 0} SMS
                        {c.costCop
                          ? ` · ${formatCop(c.costCop)} (en factura)`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function MiniKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--onda-bg)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-[var(--onda-ink)]">
        {value}
      </p>
      <p className="text-xs text-[var(--onda-muted)]">{hint}</p>
    </div>
  );
}
