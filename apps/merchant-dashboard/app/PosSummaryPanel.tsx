'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartLineUpIcon as ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { CurrencyCircleDollarIcon as CurrencyCircleDollar } from '@phosphor-icons/react/dist/csr/CurrencyCircleDollar';
import { LightbulbIcon as Lightbulb } from '@phosphor-icons/react/dist/csr/Lightbulb';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { TicketIcon as Ticket } from '@phosphor-icons/react/dist/csr/Ticket';
import { UsersThreeIcon as UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { WavesIcon as Waves } from '@phosphor-icons/react/dist/csr/Waves';
import {
  AnalyticsSectionHeader,
  KpiCard,
  SkeletonDashboard,
  api,
  type AnalyticsFiltersValue,
} from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSummaryDto } from '@onda/shared-types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const METHOD_COLORS: Record<string, string> = {
  cash: '#2BB673',
  card: '#3DB9E8',
  transfer: '#052DDE',
};

const ITEM_BAR_COLORS = ['#3DB9E8', '#052DDE', '#2BB673', '#F5A524', '#EC4899'];

function formatMoneyAxis(v: number) {
  const n = Math.abs(Number(v));
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function methodLabel(key: string) {
  return METHOD_LABELS[key] || key;
}

function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as {
    ventas?: number;
    transacciones?: number;
    ondas?: number;
  };
  return (
    <div className="rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-[var(--onda-ink)]">
        {String(label || '').slice(5).replace('-', '/')}
      </p>
      <ul className="space-y-1.5">
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--onda-sky)]" />
            Ventas
          </span>
          <span className="font-medium tabular-nums">
            {formatCop(row?.ventas ?? 0)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--onda-primary)]" />
            Transacciones
          </span>
          <span className="font-medium tabular-nums">
            {row?.transacciones ?? 0}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--onda-success)]" />
            Ondas
          </span>
          <span className="font-medium tabular-nums">{row?.ondas ?? 0}</span>
        </li>
      </ul>
    </div>
  );
}

export function PosSummaryPanel({
  storeId,
  filters,
  paymentMethods = [],
}: {
  storeId: string;
  filters: AnalyticsFiltersValue;
  paymentMethods?: string[];
}) {
  const [summary, setSummary] = useState<PosSummaryDto | null>(null);
  const methodsKey = paymentMethods.slice().sort().join(',');

  useEffect(() => {
    if (!storeId) return;
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    if (methodsKey) q.set('methods', methodsKey);
    setSummary(null);
    void api<PosSummaryDto>(`/pos/stores/${storeId}/summary?${q}`).then(
      setSummary,
    );
  }, [storeId, filters.from, filters.to, methodsKey]);

  if (!summary) {
    return <SkeletonDashboard kpis={4} />;
  }

  const series = summary.series ?? [];
  const hasSales = summary.transactionCount > 0;
  const paymentData = (summary.byPaymentMethod ?? []).map((m) => ({
    ...m,
    label: methodLabel(m.methodKey),
  }));
  const topItemsChart = (summary.topItems ?? []).slice(0, 8).map((item) => ({
    name: item.name.length > 18 ? `${item.name.slice(0, 16)}…` : item.name,
    fullName: item.name,
    quantity: item.quantity,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={formatCop(summary.totalSales)}
          tone="sky"
          icon={
            <CurrencyCircleDollar
              className="h-5 w-5"
              weight="duotone"
              aria-hidden
            />
          }
        />
        <KpiCard
          label="Transacciones"
          value={summary.transactionCount}
          tone="primary"
          icon={<Receipt className="h-5 w-5" weight="duotone" aria-hidden />}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCop(summary.averageTicket)}
          tone="amber"
          icon={<Ticket className="h-5 w-5" weight="duotone" aria-hidden />}
        />
        <KpiCard
          label="Ondas POS"
          value={summary.ondasGranted}
          tone="success"
          icon={<Waves className="h-5 w-5" weight="duotone" aria-hidden />}
        />
      </div>

      <div className="onda-card flex min-h-[18rem] flex-col overflow-hidden p-4">
        <AnalyticsSectionHeader
          icon={
            <ChartLineUp className="h-4 w-4" weight="duotone" aria-hidden />
          }
          title="Ventas por día"
          subtitle="Monto cobrado y transacciones del periodo"
          tone="sky"
          trailing={
            hasSales ? (
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--onda-sky)]" />
                  Ventas {formatCop(summary.totalSales)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--onda-primary)]" />
                  {summary.transactionCount} tx
                </span>
              </div>
            ) : null
          }
        />
        <div className="relative mt-3 min-h-[14rem] flex-1">
          {!hasSales ? (
            <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                <ChartLineUp className="h-6 w-6" weight="duotone" aria-hidden />
              </span>
              <p className="text-sm text-[var(--onda-muted)]">
                Aún no hay ventas POS en este periodo.
              </p>
              <p className="max-w-md text-xs text-[var(--onda-muted)]">
                Cuando cobres en Vender, verás aquí la curva de ventas día a día.
              </p>
            </div>
          ) : (
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={series}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="posVentasFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3DB9E8" stopOpacity={0.35} />
                      <stop
                        offset="100%"
                        stopColor="#3DB9E8"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--onda-border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => String(v).slice(5)}
                    fontSize={11}
                    tickMargin={6}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="money"
                    fontSize={11}
                    width={52}
                    tickFormatter={formatMoneyAxis}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    fontSize={11}
                    width={28}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<SalesTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                    iconSize={10}
                  />
                  <Area
                    yAxisId="money"
                    type="monotone"
                    dataKey="ventas"
                    name="Ventas"
                    stroke="#3DB9E8"
                    strokeWidth={2}
                    fill="url(#posVentasFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="transacciones"
                    name="Transacciones"
                    fill="#052DDE"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    opacity={0.85}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:[grid-auto-rows:18rem]">
        <div className="onda-card flex h-[18rem] min-h-0 flex-col overflow-hidden p-4">
          <AnalyticsSectionHeader
            icon={
              <CreditCard className="h-4 w-4" weight="duotone" aria-hidden />
            }
            title="Por medio de pago"
            subtitle="Distribución del cobro"
            tone="primary"
          />
          <div className="relative mt-3 min-h-0 flex-1">
            {paymentData.length ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {paymentData.map((row) => (
                        <Cell
                          key={row.methodKey}
                          fill={METHOD_COLORS[row.methodKey] || '#94A3B8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, _n: any, p: any) => [
                        formatCop(Number(v) || 0),
                        methodLabel(p?.payload?.methodKey),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[var(--onda-muted)]">
                  Sin cobros en el periodo.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="onda-card flex h-[18rem] min-h-0 flex-col overflow-hidden p-4">
          <AnalyticsSectionHeader
            icon={<Package className="h-4 w-4" weight="duotone" aria-hidden />}
            title="Ítems más vendidos"
            subtitle="Cantidad despachada"
            tone="sky"
          />
          <div className="relative mt-3 min-h-0 flex-1">
            {topItemsChart.length ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topItemsChart}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v} uds`, 'Cantidad']}
                      labelFormatter={(_l, items) =>
                        (items?.[0]?.payload as { fullName?: string })
                          ?.fullName || String(_l)
                      }
                    />
                    <Bar dataKey="quantity" name="Cantidad" radius={[0, 4, 4, 0]}>
                      {topItemsChart.map((_, i) => (
                        <Cell
                          key={i}
                          fill={ITEM_BAR_COLORS[i % ITEM_BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[var(--onda-muted)]">
                  Sin ítems vendidos en el periodo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {summary.insights.length > 0 ? (
        <div className="onda-card space-y-3 border-l-4 border-l-[#F5A524] p-4">
          <AnalyticsSectionHeader
            icon={
              <Lightbulb className="h-4 w-4" weight="duotone" aria-hidden />
            }
            title="Recomendaciones"
            tone="amber"
          />
          <ul className="mt-3 space-y-2 pl-1">
            {summary.insights.map((line) => (
              <li
                key={line}
                className="flex gap-2 text-sm text-[var(--onda-muted)]"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5A524]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.topCustomers.length > 0 ? (
        <div className="onda-card p-4">
          <AnalyticsSectionHeader
            icon={
              <UsersThree className="h-4 w-4" weight="duotone" aria-hidden />
            }
            title="Mejores clientes POS"
            subtitle="Por monto acumulado en el periodo"
            tone="primary"
          />
          <ul className="mt-3 space-y-2">
            {summary.topCustomers.slice(0, 5).map((c, i) => (
              <li
                key={c.passId || c.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--onda-bg)]/70 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--onda-violet-soft)] font-display text-xs font-semibold text-[var(--onda-primary-700)]">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-medium">{c.name}</span>
                </div>
                <span className="shrink-0 font-display text-sm font-semibold tabular-nums">
                  {formatCop(c.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
