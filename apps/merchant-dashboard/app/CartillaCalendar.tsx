"use client";

import { useEffect, useMemo, useState } from "react";
import { api, GradientButton, OndaIcons, SegmentedControl } from "@onda/shared-ui";

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const MS_DAY = 24 * 60 * 60 * 1000;

type Scope = "month" | "quarter" | "semester" | "year";

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "month", label: "Mes" },
  { id: "quarter", label: "Q" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Año" },
];

type CalCartilla = {
  id: string;
  name: string;
  isDefault?: boolean;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

type Kind = "default" | "active" | "scheduled";

type Segment = {
  key: string;
  cartilla: CalCartilla;
  kind: Kind;
  start: Date;
  end: Date;
  left: number;
  width: number;
};

type Lane = {
  key: string;
  cartilla: CalCartilla;
  kind: Kind;
  segment: Segment;
};

type Tick = {
  key: string;
  label: string;
  left: number;
  width: number;
  month?: number;
};

function parseDay(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(d: Date) {
  return d
    .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
    .replace(".", "");
}

function formatRange(start: Date, end: Date) {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonthsClamped(y: number, m: number, delta: number) {
  const total = y * 12 + m + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function scopeMonths(scope: Scope, year: number, month: number) {
  if (scope === "month") return [month];
  if (scope === "quarter") {
    const q = Math.floor(month / 3) * 3;
    return [q, q + 1, q + 2];
  }
  if (scope === "semester") {
    const s = Math.floor(month / 6) * 6;
    return [s, s + 1, s + 2, s + 3, s + 4, s + 5];
  }
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}

function scopeTitle(scope: Scope, year: number, month: number) {
  if (scope === "month") {
    const label = new Date(year, month, 1).toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (scope === "quarter") return `Q${Math.floor(month / 3) + 1} ${year}`;
  if (scope === "semester") {
    return `Semestre ${Math.floor(month / 6) + 1} · ${year}`;
  }
  return String(year);
}

function kindClass(kind: Kind) {
  if (kind === "active") return "bg-[var(--onda-violet)] text-white";
  if (kind === "scheduled") {
    return "bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]";
  }
  return "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]";
}

function clipToPeriod(start: Date, end: Date, from: Date, to: Date) {
  if (end < from || start > to) return null;
  return {
    start: start < from ? from : start,
    end: end > to ? to : end,
  };
}

function buildLanes(
  periodStart: Date,
  periodEnd: Date,
  daysInPeriod: number,
  cartillas: CalCartilla[],
): Lane[] {
  const toSeg = (
    cartilla: CalCartilla,
    kind: Kind,
    start: Date,
    end: Date,
  ): Segment => {
    const startIdx = Math.max(
      0,
      Math.round((startOfDay(start).getTime() - periodStart.getTime()) / MS_DAY),
    );
    const endIdx = Math.min(
      daysInPeriod - 1,
      Math.round((startOfDay(end).getTime() - periodStart.getTime()) / MS_DAY),
    );
    const span = Math.max(1, endIdx - startIdx + 1);
    return {
      key: cartilla.id,
      cartilla,
      kind,
      start,
      end,
      left: (startIdx / daysInPeriod) * 100,
      width: (span / daysInPeriod) * 100,
    };
  };

  const lanes: Lane[] = [];
  const base = cartillas.find((c) => c.isDefault);
  if (base) {
    lanes.push({
      key: base.id,
      cartilla: base,
      kind: "default",
      segment: toSeg(base, "default", periodStart, periodEnd),
    });
  }

  const others = cartillas
    .filter((c) => !c.isDefault && c.status !== "ENDED")
    .map((c) => {
      const kind: Kind = c.status === "ACTIVE" ? "active" : "scheduled";
      if (c.startsAt && c.endsAt) {
        const clipped = clipToPeriod(
          parseDay(c.startsAt),
          parseDay(c.endsAt),
          periodStart,
          periodEnd,
        );
        if (!clipped) return null;
        return {
          key: c.id,
          cartilla: c,
          kind,
          segment: toSeg(c, kind, clipped.start, clipped.end),
        };
      }
      // Cartilla permanente (sin fechas): barra de período completo.
      return {
        key: c.id,
        cartilla: c,
        kind,
        segment: toSeg(c, kind, periodStart, periodEnd),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => {
      const at = a.segment.start.getTime();
      const bt = b.segment.start.getTime();
      if (at !== bt) return at - bt;
      return a.cartilla.name.localeCompare(b.cartilla.name);
    });

  return [...lanes, ...others];
}

export function CartillaCalendar({
  storeId,
  onOpen,
  onCreate,
  onClose,
  embedded = false,
}: {
  storeId: string;
  onOpen: (id: string) => void;
  onCreate?: () => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const now = new Date();
  const [scope, setScope] = useState<Scope>("year");
  const [anchor, setAnchor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [data, setData] = useState<{
    cartillas?: CalCartilla[];
    activeId?: string;
  } | null>(null);

  useEffect(() => {
    if (!storeId) return;
    void api(
      `/cartillas/calendar?storeId=${storeId}&year=${anchor.year}`,
    ).then(setData);
  }, [storeId, anchor.year]);

  const months = scopeMonths(scope, anchor.year, anchor.month);
  const periodStart = startOfDay(new Date(anchor.year, months[0], 1));
  const periodEnd = startOfDay(
    new Date(anchor.year, months[months.length - 1] + 1, 0),
  );
  const daysInPeriod =
    Math.round((periodEnd.getTime() - periodStart.getTime()) / MS_DAY) + 1;

  const cartillas = data?.cartillas || [];
  const lanes = useMemo(
    () => buildLanes(periodStart, periodEnd, daysInPeriod, cartillas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartillas, periodStart.getTime(), periodEnd.getTime()],
  );

  const ticks = useMemo<Tick[]>(() => {
    if (scope === "month") {
      return Array.from({ length: daysInPeriod }, (_, i) => {
        const d = addDays(periodStart, i);
        return {
          key: toTickKey(d),
          label: String(d.getDate()),
          left: (i / daysInPeriod) * 100,
          width: 100 / daysInPeriod,
        };
      });
    }
    let acc = 0;
    return months.map((m) => {
      const days = new Date(anchor.year, m + 1, 0).getDate();
      const tick = {
        key: `${anchor.year}-${m}`,
        label: MONTHS[m],
        left: (acc / daysInPeriod) * 100,
        width: (days / daysInPeriod) * 100,
        month: m,
      };
      acc += days;
      return tick;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, daysInPeriod, months.join(","), anchor.year]);

  const todayPct = useMemo(() => {
    const today = startOfDay(new Date());
    if (today < periodStart || today > periodEnd) return null;
    return (
      ((today.getTime() - periodStart.getTime()) / MS_DAY + 0.5) /
      daysInPeriod *
      100
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart.getTime(), periodEnd.getTime(), daysInPeriod]);

  function toTickKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function step(delta: number) {
    const shift =
      scope === "month"
        ? delta
        : scope === "quarter"
          ? delta * 3
          : scope === "semester"
            ? delta * 6
            : delta * 12;
    setAnchor((a) => addMonthsClamped(a.year, a.month, shift));
  }

  function goToday() {
    const t = new Date();
    setAnchor({ year: t.getFullYear(), month: t.getMonth() });
  }

  function drillDown(year: number, month: number) {
    setAnchor({ year, month });
    setScope("month");
  }

  return (
    <div className="space-y-5">
      {!embedded && onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
        >
          ← Promociones
        </button>
      ) : null}
      <div className="space-y-3">
        {!embedded ? (
          <div>
            <h2 className="font-display text-xl font-semibold">
              Calendario de cartillas
            </h2>
            <p className="text-sm text-[var(--onda-muted)]">
              Cada cartilla ocupa su propia línea. La base siempre está
              disponible; las demás pueden coexistir y tus clientes eligen cuál
              cargan.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Período anterior"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
              onClick={() => step(-1)}
            >
              {OndaIcons.chevronLeft}
            </button>
            <h3 className="min-w-36 text-center font-display text-base font-semibold">
              {scopeTitle(scope, anchor.year, anchor.month)}
            </h3>
            <button
              type="button"
              aria-label="Período siguiente"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
              onClick={() => step(1)}
            >
              {OndaIcons.chevronRight}
            </button>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
            onClick={goToday}
          >
            Hoy
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="Alcance del calendario"
              value={scope}
              onChange={setScope}
              options={SCOPE_OPTIONS}
            />
            {onCreate ? (
              <GradientButton type="button" onClick={onCreate}>
                {OndaIcons.plus}
                Nueva cartilla
              </GradientButton>
            ) : null}
          </div>
        </div>
      </div>

      {lanes.length ? (
        <div className="onda-card overflow-x-auto p-4">
          <div className="relative min-w-[44rem]">
            <div className="grid grid-cols-[12rem_1fr] items-end gap-3">
              <div />
              <div className="relative h-5">
                {ticks.map((t) =>
                  scope === "month" || t.month == null ? (
                    <div
                      key={t.key}
                      className="absolute top-0 text-[11px] font-medium text-[var(--onda-muted)]"
                      style={{ left: `${t.left}%`, width: `${t.width}%` }}
                    >
                      {t.label}
                    </div>
                  ) : (
                    <button
                      key={t.key}
                      type="button"
                      title={`Ver ${MONTHS[t.month!]}`}
                      className="absolute top-0 cursor-pointer text-left text-[11px] font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
                      style={{ left: `${t.left}%`, width: `${t.width}%` }}
                      onClick={() => drillDown(anchor.year, t.month!)}
                    >
                      {t.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {lanes.map((lane) => {
              const seg = lane.segment;
              const isBase = seg.kind === "default";
              const dated = Boolean(
                seg.cartilla.startsAt && seg.cartilla.endsAt,
              );
              const showDates = seg.width >= 12 && !isBase && dated;
              const statusLabel = isBase
                ? "Base"
                : seg.cartilla.status === "ACTIVE"
                  ? "Vigente"
                  : dated
                    ? "Programada"
                    : "Borrador";
              const statusChip =
                seg.kind === "active"
                  ? "bg-[var(--onda-violet)] text-white"
                  : seg.kind === "scheduled"
                    ? "bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]"
                    : "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]";
              return (
                <div
                  key={lane.key}
                  className="mt-1.5 grid grid-cols-[12rem_1fr] items-center gap-3"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-xs font-medium text-[var(--onda-ink)]"
                      title={seg.cartilla.name}
                    >
                      {seg.cartilla.name}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium ${statusChip}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="relative h-11 overflow-hidden rounded-xl bg-[var(--onda-bg)]">
                    {ticks.map((t) => (
                      <div
                        key={`tick-${lane.key}-${t.key}`}
                        className="absolute inset-y-0 w-px bg-[var(--onda-border)]"
                        style={{ left: `${t.left}%` }}
                      />
                    ))}
                    <button
                      type="button"
                      title={`${seg.cartilla.name}${
                        isBase
                          ? ""
                          : dated
                            ? ` · ${formatRange(seg.start, seg.end)}`
                            : " · Siempre disponible"
                      }`}
                      onClick={() => onOpen(seg.cartilla.id)}
                      className={`absolute inset-y-1 cursor-pointer overflow-hidden rounded-lg px-2 text-left ${kindClass(
                        seg.kind,
                      )}`}
                      style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                    >
                      {showDates ? (
                        <span className="block truncate text-[10px] leading-4 opacity-80">
                          {formatRange(seg.start, seg.end)}
                        </span>
                      ) : null}
                    </button>
                    {todayPct != null ? (
                      <div
                        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--onda-ink)]"
                        style={{ left: `${todayPct}%` }}
                        title="Hoy"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {lanes.length <= 1 ? (
            <p className="mt-3 text-sm text-[var(--onda-muted)]">
              Sin cartillas adicionales en este período. La cartilla base cubre
              todos los días.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
