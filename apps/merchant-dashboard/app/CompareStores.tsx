"use client";

import { useMemo, useState } from "react";
import {
  KpiCard,
  InsightsPanel,
  FilterChip,
  FilterGroup,
  SegmentedControl,
  OndaIcons,
} from "@onda/shared-ui";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

export type CompareResponse = {
  range: { from: string; to: string };
  set: {
    kpis: {
      ondas: number;
      ondasDelta: number;
      redenciones: number;
      redencionesDelta: number;
      clientesNuevos: number;
      clientesNuevosDelta: number;
      tasaRedencion: number;
      tasaRedencionDelta: number;
      clientesActivos: number;
      ondasPorActivo: number;
      canjesPorActivo: number;
    };
    leaders: Record<
      string,
      { storeId: string; storeName: string; value: number } | null
    >;
    laggards: Record<
      string,
      { storeId: string; storeName: string; value: number } | null
    >;
  };
  stores: Array<{
    storeId: string;
    storeName: string;
    kpis: {
      ondas: number;
      ondasDelta: number;
      redenciones: number;
      redencionesDelta: number;
      clientesNuevos: number;
      clientesNuevosDelta: number;
      tasaRedencion: number;
      tasaRedencionDelta: number;
      clientesActivos: number;
      ondasPorActivo: number;
      canjesPorActivo: number;
      rankOndas: number;
      rankRedenciones: number;
      rankTasa: number;
    };
    segments: {
      nuevos: number;
      activos: number;
      cercaCanje: number;
      enRiesgo: number;
      vip: number;
      dormidos: number;
      total: number;
    };
    vsSet: {
      ondasPctVsAvg: number;
      redencionesPctVsAvg: number;
      tasaPpVsAvg: number;
    };
  }>;
  series: Array<{
    date: string;
    byStore: Record<string, { ondas: number; canjes: number }>;
  }>;
  insights: Array<{
    id: string;
    tone: "success" | "warning" | "danger" | "accent";
    title: string;
    message: string;
    action?: string;
    storeIds?: string[];
    stat?: string;
  }>;
};

type RankMetric = "ondas" | "redenciones" | "tasa" | "nuevos";

const STORE_COLORS = [
  "#6E5AE6",
  "#3DB9E8",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6",
];

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function metricValue(
  row: CompareResponse["stores"][0],
  metric: RankMetric,
): number {
  switch (metric) {
    case "ondas":
      return row.kpis.ondas;
    case "redenciones":
      return row.kpis.redenciones;
    case "tasa":
      return row.kpis.tasaRedencion;
    case "nuevos":
      return row.kpis.clientesNuevos;
  }
}

function formatMetric(metric: RankMetric, value: number) {
  if (metric === "tasa") return `${value}%`;
  return String(value);
}

type Props = {
  stores: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  data: CompareResponse | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenStore: (storeId: string) => void;
};

export function CompareStores({
  stores,
  selectedIds,
  onSelectedIdsChange,
  data,
  loading,
  error,
  onRetry,
  onOpenStore,
}: Props) {
  const [rankMetric, setRankMetric] = useState<RankMetric>("ondas");
  const [seriesMetric, setSeriesMetric] = useState<"ondas" | "canjes">("ondas");

  const allSelected =
    stores.length > 0 && selectedIds.length === stores.length;

  function toggleStore(id: string) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return;
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  }

  function selectAll() {
    onSelectedIdsChange(stores.map((s) => s.id));
  }

  const colorByStore = useMemo(() => {
    const map: Record<string, string> = {};
    selectedIds.forEach((id, i) => {
      map[id] = STORE_COLORS[i % STORE_COLORS.length];
    });
    return map;
  }, [selectedIds]);

  const ranked = useMemo(() => {
    if (!data?.stores) return [];
    return [...data.stores].sort(
      (a, b) => metricValue(b, rankMetric) - metricValue(a, rankMetric),
    );
  }, [data, rankMetric]);

  const maxRankValue = useMemo(() => {
    if (!ranked.length) return 1;
    return Math.max(1, ...ranked.map((r) => metricValue(r, rankMetric)));
  }, [ranked, rankMetric]);

  const seriesChartData = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map((row) => {
      const point: Record<string, string | number> = { date: row.date.slice(5) };
      for (const id of selectedIds) {
        const cell = row.byStore[id];
        point[id] =
          seriesMetric === "ondas" ? (cell?.ondas ?? 0) : (cell?.canjes ?? 0);
      }
      return point;
    });
  }, [data, selectedIds, seriesMetric]);

  const segmentChartData = useMemo(() => {
    if (!data?.stores) return [];
    return data.stores.map((s) => {
      const total = Math.max(
        1,
        s.segments.activos +
          s.segments.cercaCanje +
          s.segments.enRiesgo +
          s.segments.dormidos +
          s.segments.vip,
      );
      // Use absolute counts for stacked bars (more readable than forced 100%)
      return {
        name:
          s.storeName.length > 14
            ? `${s.storeName.slice(0, 12)}…`
            : s.storeName,
        storeId: s.storeId,
        activos: s.segments.activos,
        cercaCanje: s.segments.cercaCanje,
        enRiesgo: s.segments.enRiesgo,
        dormidos: s.segments.dormidos,
        vip: s.segments.vip,
        _total: total,
      };
    });
  }, [data]);

  const displayKpis = data?.set.kpis;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-[var(--onda-border)] bg-white shadow-[0_1px_2px_rgba(26,27,46,0.04)]">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3">
          <FilterGroup label="Sedes" className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                selected={allSelected}
                onClick={selectAll}
                icon={OndaIcons.all}
              >
                Todas
              </FilterChip>
              {stores.map((s) => (
                <FilterChip
                  key={s.id}
                  selected={selectedIds.includes(s.id)}
                  onClick={() => toggleStore(s.id)}
                >
                  {s.name}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        </div>
      </div>

      {selectedIds.length < 2 ? (
        <p className="text-sm text-[var(--onda-muted)]">
          Añade otra sede para comparar. Con una sola ves el detalle del
          periodo, sin contraste relativo.
        </p>
      ) : null}

      {error && !loading ? (
        <div className="rounded-xl border border-[var(--onda-danger)]/25 bg-[var(--onda-danger)]/8 px-4 py-3">
          <p className="text-sm text-[var(--onda-ink)]">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 cursor-pointer text-xs font-medium text-[var(--onda-violet)] hover:underline"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*]:min-w-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-[var(--onda-border)]/40"
            />
          ))}
        </div>
      ) : null}

      {data && displayKpis ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*]:min-w-0">
            <KpiCard
              label="Ondas del grupo"
              hint="Onda = punto que el cliente gana en cada compra."
              value={displayKpis.ondas}
              delta={deltaLabel(displayKpis.ondasDelta)}
              positive={(displayKpis.ondasDelta ?? 0) >= 0}
            />
            <KpiCard
              label="Canjes del grupo"
              value={displayKpis.redenciones}
              delta={deltaLabel(displayKpis.redencionesDelta)}
              positive={(displayKpis.redencionesDelta ?? 0) >= 0}
            />
            <KpiCard
              label="Tasa redención"
              hint="Compara cuántas veces canjearon una promo contra cuántas veces sumaron ondas. Puede superar 100% si canjean ondas que ya tenían acumuladas."
              value={`${displayKpis.tasaRedencion}%`}
              delta={
                displayKpis.tasaRedencionDelta != null
                  ? `${displayKpis.tasaRedencionDelta > 0 ? "+" : ""}${displayKpis.tasaRedencionDelta} pp`
                  : undefined
              }
              positive={(displayKpis.tasaRedencionDelta ?? 0) >= 0}
            />
            <KpiCard
              label="Clientes nuevos"
              value={displayKpis.clientesNuevos}
              delta={deltaLabel(displayKpis.clientesNuevosDelta)}
              positive={(displayKpis.clientesNuevosDelta ?? 0) >= 0}
            />
            <KpiCard
              label="Clientes activos"
              value={displayKpis.clientesActivos}
            />
          </div>

          {(data.insights || []).length > 0 ? (
            <InsightsPanel
              items={data.insights.map((ins) => ({
                id: ins.id,
                tone: ins.tone,
                title: ins.title,
                message: ins.message,
                stat: ins.stat,
                action: ins.action,
                onAction: ins.storeIds?.[0]
                  ? () => onOpenStore(ins.storeIds![0])
                  : undefined,
              }))}
            />
          ) : null}

          <div className="onda-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-sm font-semibold">Ranking</h3>
              <SegmentedControl
                aria-label="Métrica de ranking"
                value={rankMetric}
                onChange={(v) => setRankMetric(v as RankMetric)}
                options={[
                  { id: "ondas", label: "Ondas" },
                  { id: "redenciones", label: "Canjes" },
                  { id: "tasa", label: "Tasa" },
                  { id: "nuevos", label: "Nuevos" },
                ]}
              />
            </div>
            <ul className="mt-4 space-y-3">
              {ranked.map((row, idx) => {
                const value = metricValue(row, rankMetric);
                const pct = Math.round((value / maxRankValue) * 100);
                return (
                  <li key={row.storeId}>
                    <button
                      type="button"
                      onClick={() => onOpenStore(row.storeId)}
                      className="group w-full cursor-pointer text-left"
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-[var(--onda-ink)] group-hover:text-[var(--onda-violet)]">
                          <span className="mr-2 text-[var(--onda-muted)]">
                            #{idx + 1}
                          </span>
                          {row.storeName}
                        </span>
                        <span className="tabular-nums text-[var(--onda-muted)]">
                          {formatMetric(rankMetric, value)}
                          {rankMetric === "ondas" ||
                          rankMetric === "redenciones" ? (
                            <span className="ml-2 text-[11px]">
                              {row.vsSet.ondasPctVsAvg > 0 ? "+" : ""}
                              {rankMetric === "ondas"
                                ? row.vsSet.ondasPctVsAvg
                                : row.vsSet.redencionesPctVsAvg}
                              % vs avg
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-md bg-[var(--onda-border)]/50">
                        <div
                          className="h-full rounded-md bg-[var(--onda-violet)] transition-all"
                          style={{
                            width: `${pct}%`,
                            opacity: 0.35 + (pct / 100) * 0.65,
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="onda-card flex min-h-[16rem] flex-col p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-sm font-semibold">
                Evolución por sede
              </h3>
              <SegmentedControl
                aria-label="Serie"
                value={seriesMetric}
                onChange={(v) => setSeriesMetric(v as "ondas" | "canjes")}
                options={[
                  { id: "ondas", label: "Ondas" },
                  { id: "canjes", label: "Canjes" },
                ]}
              />
            </div>
            <div className="relative mt-2 min-h-[12rem] flex-1">
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={seriesChartData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="var(--onda-muted)"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--onda-muted)" />
                    <Tooltip />
                    <Legend />
                    {selectedIds.map((id) => {
                      const name =
                        stores.find((s) => s.id === id)?.name || id.slice(0, 6);
                      return (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={id}
                          name={name}
                          stroke={colorByStore[id]}
                          strokeWidth={2}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="onda-card flex min-h-[14rem] flex-col p-4">
            <h3 className="font-display text-sm font-semibold">
              Salud de clientes por sede
            </h3>
            <div className="relative mt-2 min-h-[11rem] flex-1">
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={segmentChartData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="var(--onda-muted)"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--onda-muted)" />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="activos"
                      name="Activos"
                      stackId="seg"
                      fill="#22C55E"
                    />
                    <Bar
                      dataKey="cercaCanje"
                      name="Cerca canje"
                      stackId="seg"
                      fill="#3DB9E8"
                    />
                    <Bar
                      dataKey="vip"
                      name="VIP"
                      stackId="seg"
                      fill="#F59E0B"
                    />
                    <Bar
                      dataKey="enRiesgo"
                      name="En riesgo"
                      stackId="seg"
                      fill="#EF4444"
                    />
                    <Bar
                      dataKey="dormidos"
                      name="Dormidos"
                      stackId="seg"
                      fill="#94A3B8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--onda-muted)]">
              Clic en una sede del ranking para abrir su resumen con el mismo
              rango de fechas.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
