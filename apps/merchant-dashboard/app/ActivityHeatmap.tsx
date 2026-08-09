"use client";

import { useMemo, useState } from "react";
import { SegmentedControl } from "@onda/shared-ui";

type HeatCell = {
  dow: number;
  hour: number;
  ondas: number;
  canjes: number;
  freq: number;
};

type HeatmapData = {
  days: string[];
  cells: HeatCell[];
};

type Metric = "acumulaciones" | "redenciones";

type HoverTip = {
  day: string;
  hour: number;
  acumulaciones: number;
  redenciones: number;
  x: number;
  y: number;
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6–23

function cellColor(metric: Metric, t: number): string {
  if (t <= 0) return "var(--onda-border)";
  if (metric === "redenciones") {
    if (t < 0.25) return "color-mix(in srgb, var(--onda-violet) 18%, white)";
    if (t < 0.5) return "color-mix(in srgb, var(--onda-violet) 40%, white)";
    if (t < 0.75) return "color-mix(in srgb, var(--onda-violet) 65%, white)";
    return "var(--onda-violet)";
  }
  if (t < 0.25) return "color-mix(in srgb, var(--onda-sky) 18%, white)";
  if (t < 0.5) return "color-mix(in srgb, var(--onda-sky) 40%, white)";
  if (t < 0.75) return "color-mix(in srgb, var(--onda-sky) 65%, white)";
  return "var(--onda-sky)";
}

function metricValue(cell: HeatCell | undefined, metric: Metric): number {
  if (!cell) return 0;
  return metric === "redenciones" ? cell.canjes : cell.ondas;
}

export function ActivityHeatmap({ data }: { data: HeatmapData | null | undefined }) {
  const [metric, setMetric] = useState<Metric>("acumulaciones");
  const [tip, setTip] = useState<HoverTip | null>(null);
  const days = data?.days || ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const lookup = useMemo(() => {
    const map = new Map<string, HeatCell>();
    for (const c of data?.cells || []) {
      map.set(`${c.dow}-${c.hour}`, c);
    }
    return map;
  }, [data]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const c of data?.cells || []) {
      const v = metricValue(c, metric);
      if (v > m) m = v;
    }
    return m;
  }, [data, metric]);

  return (
    <div className="onda-card relative flex h-full min-h-[16rem] flex-col p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold">
            Actividad por día y hora
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--onda-muted)]">
            Cuándo se acumulan ondas y se canjean promos
          </p>
        </div>
        <SegmentedControl
          aria-label="Tipo de actividad"
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          options={[
            { id: "acumulaciones", label: "Acumulaciones" },
            { id: "redenciones", label: "Redenciones" },
          ]}
        />
      </div>

      <div
        className="relative mt-3 min-w-0 flex-1 overflow-x-auto"
        onMouseLeave={() => setTip(null)}
      >
        <div
          className="inline-grid min-w-full gap-0.5"
          style={{
            gridTemplateColumns: `2rem repeat(${HOURS.length}, minmax(0.7rem, 1fr))`,
          }}
        >
          <div />
          {HOURS.map((h) => (
            <div
              key={`h-${h}`}
              className="pb-1 text-center text-[9px] tabular-nums text-[var(--onda-muted)]"
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}

          {days.map((day, dow) => (
            <div key={day} className="contents">
              <div className="flex items-center pr-1 text-[10px] font-medium text-[var(--onda-muted)]">
                {day}
              </div>
              {HOURS.map((hour) => {
                const cell = lookup.get(`${dow}-${hour}`);
                const raw = metricValue(cell, metric);
                const t = maxVal > 0 ? raw / maxVal : 0;
                const acumulaciones = cell?.ondas ?? 0;
                const redenciones = cell?.canjes ?? 0;
                return (
                  <div
                    key={`${dow}-${hour}`}
                    className="aspect-square min-h-[0.7rem] cursor-default rounded-[3px]"
                    style={{ background: cellColor(metric, t) }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const parent = e.currentTarget.closest(".relative");
                      const pref = parent?.getBoundingClientRect();
                      setTip({
                        day,
                        hour,
                        acumulaciones,
                        redenciones,
                        x: rect.left - (pref?.left ?? 0) + rect.width / 2,
                        y: rect.top - (pref?.top ?? 0) - 8,
                      });
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {tip ? (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--onda-border)] bg-[var(--onda-card)] px-2.5 py-2 shadow-md"
            style={{ left: tip.x, top: tip.y }}
          >
            <p className="whitespace-nowrap text-[11px] font-semibold text-[var(--onda-ink)]">
              {tip.day} · {tip.hour}:00
            </p>
            <p className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-[var(--onda-muted)]">
              Acumulaciones{" "}
              <span className="font-semibold text-[var(--onda-sky)]">
                {tip.acumulaciones}
              </span>
            </p>
            <p className="whitespace-nowrap text-[11px] tabular-nums text-[var(--onda-muted)]">
              Redenciones{" "}
              <span className="font-semibold text-[var(--onda-violet)]">
                {tip.redenciones}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[var(--onda-muted)]">
        <span>Menos</span>
        <div className="flex flex-1 items-center gap-0.5 px-2">
          {[0, 0.2, 0.4, 0.6, 0.85, 1].map((t) => (
            <div
              key={t}
              className="h-2 flex-1 rounded-sm"
              style={{ background: cellColor(metric, t === 0 ? 0 : t) }}
            />
          ))}
        </div>
        <span>Más</span>
      </div>
    </div>
  );
}
