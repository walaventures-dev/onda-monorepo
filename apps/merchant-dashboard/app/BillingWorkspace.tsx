"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimpleIcon as Download } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { api, toast } from "@onda/shared-ui";
import {
  formatChargeDate,
  formatCop,
  PLAN_META,
  type PlanId,
} from "@onda/shared-utils";

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
  kind: "PLAN" | "USAGE" | "COMBINED";
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

const KIND_LABEL: Record<InvoiceRow["kind"], string> = {
  PLAN: "Plan",
  USAGE: "Consumos",
  COMBINED: "Plan + consumos",
};

const STATUS_LABEL: Record<string, string> = {
  PAID: "Pagado",
  ZERO: "Sin cargo",
  ISSUED: "Emitido",
  FAILED: "Falló el cobro",
  CARRIED: "Saldo al siguiente mes",
};

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isLocalhost() {
  if (typeof window === "undefined") return false;
  return (
    process.env.NODE_ENV === "development" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function mockBilling(): {
  summary: BillingSummary;
  invoices: InvoiceRow[];
  usage: UsageBreakdown;
} {
  const now = new Date();
  const usageStart = monthsAgo(0);
  usageStart.setDate(1);
  const usageEnd = new Date(usageStart);
  usageEnd.setMonth(usageEnd.getMonth() + 1);
  const nextPlan = monthsAgo(-4);
  nextPlan.setDate(15);

  const invoices: InvoiceRow[] = [
    {
      id: "mock-inv-6",
      kind: "USAGE",
      status: "ISSUED",
      invoiceNumber: "WV-2026-000128",
      periodStart: monthsAgo(1).toISOString(),
      periodEnd: now.toISOString(),
      totalCop: 0,
      chargedCop: 0,
      issuedAt: monthsAgo(0).toISOString(),
      extraCustomersCount: 0,
      extraSmsCount: 0,
      campaignsCount: 2,
    },
    {
      id: "mock-inv-5",
      kind: "USAGE",
      status: "PAID",
      invoiceNumber: "WV-2026-000121",
      periodStart: monthsAgo(2).toISOString(),
      periodEnd: monthsAgo(1).toISOString(),
      totalCop: 22_500,
      chargedCop: 22_500,
      issuedAt: monthsAgo(1).toISOString(),
      extraCustomersCount: 24,
      extraSmsCount: 70,
      campaignsCount: 3,
    },
    {
      id: "mock-inv-4",
      kind: "COMBINED",
      status: "PAID",
      invoiceNumber: "WV-2026-000110",
      periodStart: monthsAgo(3).toISOString(),
      periodEnd: monthsAgo(2).toISOString(),
      totalCop: 79_900,
      chargedCop: 79_900,
      issuedAt: monthsAgo(2).toISOString(),
      extraCustomersCount: 12,
      extraSmsCount: 20,
      campaignsCount: 2,
    },
    {
      id: "mock-inv-3",
      kind: "USAGE",
      status: "CARRIED",
      invoiceNumber: "WV-2026-000098",
      periodStart: monthsAgo(4).toISOString(),
      periodEnd: monthsAgo(3).toISOString(),
      totalCop: 1_000,
      chargedCop: 0,
      issuedAt: monthsAgo(3).toISOString(),
      extraCustomersCount: 2,
      extraSmsCount: 0,
      campaignsCount: 1,
    },
    {
      id: "mock-inv-2",
      kind: "USAGE",
      status: "FAILED",
      invoiceNumber: "WV-2026-000087",
      periodStart: monthsAgo(5).toISOString(),
      periodEnd: monthsAgo(4).toISOString(),
      totalCop: 8_400,
      chargedCop: 0,
      issuedAt: monthsAgo(4).toISOString(),
      extraCustomersCount: 6,
      extraSmsCount: 36,
      campaignsCount: 2,
    },
    {
      id: "mock-inv-1",
      kind: "PLAN",
      status: "PAID",
      invoiceNumber: "WV-2026-000071",
      periodStart: monthsAgo(6).toISOString(),
      periodEnd: monthsAgo(0).toISOString(),
      totalCop: 718_800,
      chargedCop: 718_800,
      issuedAt: monthsAgo(6).toISOString(),
      extraCustomersCount: 0,
      extraSmsCount: 0,
      campaignsCount: 0,
    },
    {
      id: "mock-inv-0",
      kind: "USAGE",
      status: "ZERO",
      invoiceNumber: "WV-2026-000064",
      periodStart: monthsAgo(7).toISOString(),
      periodEnd: monthsAgo(6).toISOString(),
      totalCop: 0,
      chargedCop: 0,
      issuedAt: monthsAgo(6).toISOString(),
      extraCustomersCount: 0,
      extraSmsCount: 0,
      campaignsCount: 1,
    },
  ];

  return {
    summary: {
      planType: "PRO",
      billingStatus: "ACTIVE",
      billingPeriod: "12",
      nextBillingAt: nextPlan.toISOString(),
      nextUsageBillingAt: usageEnd.toISOString(),
      usagePeriodStart: usageStart.toISOString(),
      usagePeriodEnd: usageEnd.toISOString(),
      newCustomersUsed: 342,
      newCustomersLimit: 300,
      extraCustomers: 42,
      extraCustomersCop: 21_000,
      smsUsed: 418,
      smsLimit: 300,
      extraSms: 118,
      extraSmsCop: 17_700,
      campaignsCount: 4,
      usageProjectedCop: 39_700,
      carriedBalanceCop: 1_000,
      planPriceCop: 69_900,
      issuer: {
        legalName: "Wala Ventures S.A.S",
        website: "walaventures.io",
        nit: "902055897-8",
      },
    },
    invoices,
    usage: {
      newCustomersUsed: 342,
      extraCustomers: 42,
      extraCustomersCop: 21_000,
      smsUsed: 418,
      extraSms: 118,
      extraSmsCop: 17_700,
      projectedCop: 38_700,
      campaigns: [
        {
          id: "mock-c1",
          title: "Win-back jueves lento",
          sentAt: monthsAgo(0).toISOString(),
          smsReachCount: 180,
          reachCount: 180,
          costCop: 12_000,
        },
        {
          id: "mock-c2",
          title: "Cerca de canjear · almuerzo",
          sentAt: monthsAgo(0).toISOString(),
          smsReachCount: 96,
          reachCount: 96,
          costCop: 3_600,
        },
        {
          id: "mock-c3",
          title: "Clientes dormidos",
          sentAt: monthsAgo(1).toISOString(),
          smsReachCount: 142,
          reachCount: 142,
          costCop: 6_300,
        },
        {
          id: "mock-c4",
          title: "Reseñas Google",
          sentAt: monthsAgo(1).toISOString(),
          smsReachCount: 40,
          reachCount: 40,
          costCop: 0,
        },
      ],
    },
  };
}

export function BillingWorkspace({ storeId }: { storeId: string }) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [usage, setUsage] = useState<UsageBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockOn, setMockOn] = useState(false);
  const [isLocalDev, setIsLocalDev] = useState(false);
  const loadSeq = useRef(0);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));

  useEffect(() => {
    setIsLocalDev(isLocalhost());
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (mockOn) {
      const mock = mockBilling();
      setSummary(mock.summary);
      setInvoices(mock.invoices);
      setUsage(mock.usage);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = `from=${from}T00:00:00.000Z&to=${to}T23:59:59.999Z`;
      const [s, inv, u] = await Promise.all([
        api<BillingSummary>(`/billing/store/${storeId}`),
        api<InvoiceRow[]>(`/billing/store/${storeId}/invoices?${qs}`),
        api<UsageBreakdown>(`/billing/store/${storeId}/usage?${qs}`),
      ]);
      if (seq !== loadSeq.current) return;
      setSummary(s);
      setInvoices(inv);
      setUsage(u);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      toast(e instanceof Error ? e.message : "No se pudo cargar facturación");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [storeId, from, to, mockOn]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleMock() {
    setMockOn((on) => {
      const next = !on;
      toast(
        next
          ? "Datos demo de facturación (solo local)"
          : "Volviste a los datos reales"
      );
      return next;
    });
  }

  const planName = summary ? PLAN_META[summary.planType].name : "—";

  const meters = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Clientes nuevos",
        used: summary.newCustomersUsed,
        limit: summary.newCustomersLimit,
        extra: summary.extraCustomers,
        extraCop: summary.extraCustomersCop,
      },
      {
        label: "SMS de campañas",
        used: summary.smsUsed,
        limit: summary.smsLimit,
        extra: summary.extraSms,
        extraCop: summary.extraSmsCop,
      },
    ];
  }, [summary]);

  function downloadPdf(id: string) {
    if (mockOn) {
      toast("Simulación: el PDF no se descarga en demo");
      return;
    }
    window.open(`/api/billing/store/${storeId}/invoices/${id}/pdf`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
            Facturación
          </h1>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            Recibos del plan y de consumos adicionales.
          </p>
        </div>
        {isLocalDev ? (
          <button
            type="button"
            onClick={toggleMock}
            className="rounded-full border border-dashed border-[var(--onda-bridge)] bg-[var(--onda-primary-50)] px-4 py-2 text-xs font-semibold text-[var(--onda-primary-700)] hover:bg-[var(--onda-primary-100)]"
          >
            {mockOn ? "Quitar simulación" : "Simular datos (local)"}
          </button>
        ) : null}
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
                {formatCop(summary?.planPriceCop ?? 0)} / mes ·{" "}
                {summary?.billingStatus === "ACTIVE"
                  ? "Activo"
                  : summary?.billingStatus}
              </p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--onda-muted)]">Corte del plan</dt>
                  <dd className="tabular-nums">
                    {summary?.nextBillingAt
                      ? formatChargeDate(new Date(summary.nextBillingAt))
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--onda-muted)]">
                    Corte de consumos
                  </dt>
                  <dd className="tabular-nums">
                    {summary?.nextUsageBillingAt
                      ? formatChargeDate(new Date(summary.nextUsageBillingAt))
                      : "—"}
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
                      : "—"}
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
                    Math.round((m.used / Math.max(1, m.limit)) * 100),
                  );
                  return (
                    <div key={m.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-[var(--onda-ink)]">
                          {m.label}
                        </span>
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
                          {m.extra} extra · {formatCop(m.extraCop)} en la
                          próxima factura
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
                      : "Sin extras"
                  }
                />
                <MiniKpi
                  label="SMS"
                  value={`${usage.smsUsed}`}
                  hint={
                    usage.extraSms > 0
                      ? `${usage.extraSms} extra · ${formatCop(usage.extraSmsCop)}`
                      : "Sin extras"
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
                          {formatChargeDate(new Date(inv.periodStart))} –{" "}
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
                        {c.sentAt ? formatChargeDate(new Date(c.sentAt)) : "—"}{" "}
                        · {c.smsReachCount ?? c.reachCount ?? 0} SMS
                        {c.costCop
                          ? ` · ${formatCop(c.costCop)} (en factura)`
                          : ""}
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
