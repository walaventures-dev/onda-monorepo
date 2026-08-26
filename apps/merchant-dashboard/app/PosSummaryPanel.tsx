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
import { api } from '@onda/shared-ui';
import { formatCop } from '@onda/shared-utils';
import type { PosSummaryDto } from '@onda/shared-types';
import type { AnalyticsFiltersValue } from '@onda/shared-ui';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const METHOD_COLORS: Record<string, string> = {
  cash: '#22C55E',
  card: '#3DB9E8',
  transfer: '#6E5AE6',
};

const ITEM_BAR_COLORS = ['#3DB9E8', '#6E5AE6', '#22C55E', '#F59E0B', '#EC4899'];

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
            <span className="h-2 w-2 rounded-full bg-[#3DB9E8]" />
            Ventas
          </span>
          <span className="font-medium tabular-nums">
            {formatCop(row?.ventas ?? 0)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[#6E5AE6]" />
            Transacciones
          </span>
          <span className="font-medium tabular-nums">
            {row?.transacciones ?? 0}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
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
}: {
  storeId: string;
  filters: AnalyticsFiltersValue;
}) {
  const [summary, setSummary] = useState<PosSummaryDto | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    void api<PosSummaryDto>(`/pos/stores/${storeId}/summary?${q}`).then(
      setSummary,
    );
  }, [storeId, filters.from, filters.to]);

  if (!summary) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">Cargando resumen POS…</p>
    );
  }

  const series = summary.series ?? [];
  const hasSales = summary.transactionCount > 0;
  const paymentData = (summary.byPaymentMethod ?? []).map((m) => ({
    ...m,
    label: methodLabel(m.methodKey),
  }));
  const topItemsChart = (summary.topItems ?? []).slice(0, 8).map((item) => ({
    name:
      item.name.length > 18 ? `${item.name.slice(0, 16)}…` : item.name,
    fullName: item.name,
    quantity: item.quantity,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Resumen POS</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Ventas del periodo seleccionado
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="onda-card p-4">
          <p className="text-xs text-[var(--onda-muted)]">Ventas</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatCop(summary.totalSales)}
          </p>
        </div>
        <div className="onda-card p-4">
          <p className="text-xs text-[var(--onda-muted)]">Transacciones</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {summary.transactionCount}
          </p>
        </div>
        <div className="onda-card p-4">
          <p className="text-xs text-[var(--onda-muted)]">Ticket promedio</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatCop(summary.averageTicket)}
          </p>
        </div>
        <div className="onda-card p-4">
          <p className="text-xs text-[var(--onda-muted)]">Ondas POS</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {summary.ondasGranted}
          </p>
        </div>
      </div>

      <div className="onda-card flex min-h-[18rem] flex-col overflow-hidden p-4">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold">
              Ventas por día
            </h3>
            <p className="text-xs text-[var(--onda-muted)]">
              Monto cobrado, transacciones y ondas del periodo
            </p>
          </div>
          {hasSales ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3DB9E8]" />
                Ventas {formatCop(summary.totalSales)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6E5AE6]" />
                {summary.transactionCount} tx
              </span>
            </div>
          ) : null}
        </div>
        <div className="relative mt-2 min-h-[14rem] flex-1">
          {!hasSales ? (
            <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-4 text-center">
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
                    fill="#6E5AE6"
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
          <h3 className="font-display shrink-0 text-sm font-semibold">
            Por medio de pago
          </h3>
          <div className="relative mt-2 min-h-0 flex-1">
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
                          fill={
                            METHOD_COLORS[row.methodKey] || '#94A3B8'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, _n: any, p: any) => [
                        formatCop(Number(v) || 0),
                        methodLabel(p?.payload?.methodKey),
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      iconSize={10}
                    />
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
          <h3 className="font-display shrink-0 text-sm font-semibold">
            Ítems más vendidos
          </h3>
          <div className="relative mt-2 min-h-0 flex-1">
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
        <div className="onda-card space-y-2 p-4">
          <h3 className="text-sm font-semibold">Recomendaciones</h3>
          <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--onda-muted)]">
            {summary.insights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.topCustomers.length > 0 ? (
        <div className="onda-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Mejores clientes POS</h3>
          <ul className="space-y-2 text-sm">
            {summary.topCustomers.slice(0, 5).map((c) => (
              <li key={c.passId || c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums">{formatCop(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
