"use client";

import { useMemo, useState } from "react";
import { SegmentedControl, OndaIcons, formatPromoBenefit } from "@onda/shared-ui";

type Scope = "month" | "quarter" | "semester" | "year";

type CalPromo = {
  id: string;
  title: string;
  type: string;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
  pool?: string;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
};

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "month", label: "Mes" },
  { id: "quarter", label: "Q" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Año" },
];

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS_SHORT = [
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

const MAX_SPAN_DAYS = 370;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateLoose(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
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

function effectiveRange(p: CalPromo): { start: Date; end: Date | null } | null {
  const start =
    parseDateLoose(p.startsAt) ||
    parseDateLoose(p.createdAt) ||
    null;
  if (!start) return null;
  return { start: startOfDay(start), end: parseDateLoose(p.endsAt) };
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

function chipClass(p: CalPromo) {
  const base = "block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition cursor-pointer ";
  const pool =
    p.pool === "BIENVENIDA"
      ? "bg-[var(--onda-sky-soft)] text-[var(--onda-ink)] hover:brightness-95"
      : "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)] hover:brightness-95";
  return base + pool + (p.isActive === false ? " opacity-45" : "");
}

function PromoChip({
  promo,
  onOpen,
}: {
  promo: CalPromo;
  onOpen: (id: string) => void;
}) {
  const benefit = formatPromoBenefit(promo);
  return (
    <button
      type="button"
      className={chipClass(promo)}
      title={`${promo.title}${benefit ? ` · ${benefit}` : ""}`}
      onClick={() => onOpen(promo.id)}
    >
      <span className="block truncate">{promo.title}</span>
      {benefit ? (
        <span className="block truncate opacity-75">{benefit}</span>
      ) : null}
    </button>
  );
}

function MonthCell({
  year,
  month,
  count,
  byDay,
  isCurrentMonth,
  onOpenPromo,
  onDrillDown,
}: {
  year: number;
  month: number;
  count: number;
  byDay: Map<string, CalPromo[]>;
  isCurrentMonth: boolean;
  onOpenPromo: (id: string) => void;
  onDrillDown: (year: number, month: number) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-start
  const todayKey = toDayKey(new Date());

  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] ${
        isCurrentMonth ? "" : "opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-[var(--onda-border)] px-2 py-1.5">
        <p className="text-xs font-semibold">{MONTHS_SHORT[month]}</p>
        <button
          type="button"
          className="cursor-pointer rounded-full px-1.5 py-0.5 text-[10px] font-medium text-[var(--onda-muted)] hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
          onClick={() => onDrillDown(year, month)}
        >
          {count} promo{count === 1 ? "" : "s"} ›
        </button>
      </div>
      <div className="grid flex-1 grid-cols-7 gap-px bg-[var(--onda-border)]/40 p-0">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-[var(--onda-card)] px-1 py-0.5 text-center text-[9px] font-medium text-[var(--onda-muted)]"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`blank-${i}`} className="bg-[var(--onda-card)]" />;
          }
          const key = `${year}-${pad2(month + 1)}-${pad2(cell.day)}`;
          const dayPromos = byDay.get(key) || [];
          const isToday = key === todayKey;
          const shown = expandedDay === key ? dayPromos : dayPromos.slice(0, 3);
          const hidden = dayPromos.length - shown.length;
          return (
            <div
              key={key}
              className={`min-h-10 bg-[var(--onda-card)] px-0.5 py-0.5 ${
                isToday ? "bg-[var(--onda-violet-soft)]/40" : ""
              }`}
            >
              <p
                className={`mb-0.5 text-right text-[9px] leading-none ${
                  isToday
                    ? "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--onda-violet)] text-white"
                    : "text-[var(--onda-muted)]"
                }`}
              >
                {cell.day}
              </p>
              <div className="space-y-0.5">
                {shown.map((p) => (
                  <PromoChip key={p.id} promo={p} onOpen={onOpenPromo} />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="block w-full cursor-pointer rounded-md px-1.5 py-0.5 text-left text-[9px] font-medium text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]"
                    onClick={() =>
                      setExpandedDay(expandedDay === key ? null : key)
                    }
                  >
                    +{hidden} más
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthSummaryCell({
  year,
  month,
  promos,
  onOpenPromo,
  onDrillDown,
}: {
  year: number;
  month: number;
  promos: CalPromo[];
  onOpenPromo: (id: string) => void;
  onDrillDown: (year: number, month: number) => void;
}) {
  const shown = promos.slice(0, 2);
  const hidden = promos.length - shown.length;
  return (
    <button
      type="button"
      className="onda-card min-h-28 cursor-pointer p-3 text-left transition hover:brightness-[0.98]"
      onClick={() => onDrillDown(year, month)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{MONTHS_SHORT[month]}</p>
        <span className="rounded-full bg-[var(--onda-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-muted)]">
          {promos.length} promo{promos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 space-y-0.5">
        {shown.map((p) => (
          <PromoChip key={p.id} promo={p} onOpen={onOpenPromo} />
        ))}
        {hidden > 0 ? (
          <p className="px-1.5 text-[10px] font-medium text-[var(--onda-muted)]">
            +{hidden} más
          </p>
        ) : null}
        {!promos.length ? (
          <p className="px-1.5 text-[10px] text-[var(--onda-muted)]">
            Sin promociones
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function PromoCalendar({
  promos,
  onOpenPromo,
}: {
  promos: CalPromo[];
  onOpenPromo: (id: string) => void;
}) {
  const now = new Date();
  const [scope, setScope] = useState<Scope>("month");
  const [anchor, setAnchor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const months = scopeMonths(scope, anchor.year, anchor.month);
  const periodStart = new Date(anchor.year, months[0], 1);
  const periodEnd = new Date(anchor.year, months[months.length - 1] + 1, 0);
  const periodStartKey = toDayKey(periodStart);
  const periodEndKey = toDayKey(periodEnd);

  const byDay = useMemo(() => {
    const map = new Map<string, CalPromo[]>();
    for (const p of promos) {
      const range = effectiveRange(p);
      if (!range) continue;
      let d = range.start < periodStart ? periodStart : range.start;
      let n = 0;
      while ((range.end == null || d <= range.end) && n < MAX_SPAN_DAYS) {
        const key = toDayKey(d);
        if (key < periodStartKey) break;
        const arr = map.get(key);
        if (arr) arr.push(p);
        else map.set(key, [p]);
        d = addDays(d, 1);
        n += 1;
      }
    }
    return map;
  }, [promos, periodStart, periodStartKey]);

  const promosInPeriod = useMemo(
    () =>
      promos.filter((p) => {
        const range = effectiveRange(p);
        if (!range) return false;
        return (
          range.start <= periodEnd && (range.end == null || range.end >= periodStart)
        );
      }),
    [promos, periodStart, periodEnd],
  );

  function step(delta: number) {
    const shift =
      scope === "month" ? delta : scope === "quarter" ? delta * 3 : scope === "semester" ? delta * 6 : delta * 12;
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

  const cols =
    scope === "month"
      ? "grid-cols-1"
      : scope === "quarter"
        ? "grid-cols-1 sm:grid-cols-3"
        : scope === "semester"
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="space-y-3">
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
        <div className="ml-auto">
          <SegmentedControl
            aria-label="Alcance del calendario"
            value={scope}
            onChange={setScope}
            options={SCOPE_OPTIONS}
          />
        </div>
      </div>

      {!promosInPeriod.length ? (
        <p className="rounded-2xl border border-dashed border-[var(--onda-border)] p-6 text-center text-sm text-[var(--onda-muted)]">
          No hay promociones en este período. Crea una con “+ Nueva promo” y
          asígnale una vigencia para verla aquí.
        </p>
      ) : scope === "month" ? (
        <MonthCell
          year={anchor.year}
          month={anchor.month}
          count={promosInPeriod.length}
          byDay={byDay}
          isCurrentMonth
          onOpenPromo={onOpenPromo}
          onDrillDown={drillDown}
        />
      ) : (
        <div className={`grid gap-2 ${cols}`}>
          {months.map((m) => (
            <MonthSummaryCell
              key={`${anchor.year}-${m}`}
              year={anchor.year}
              month={m}
              promos={promos.filter((p) => {
                const range = effectiveRange(p);
                if (!range) return false;
                const monthStart = new Date(anchor.year, m, 1);
                const monthEnd = new Date(anchor.year, m + 1, 0);
                return range.start <= monthEnd && (range.end == null || range.end >= monthStart);
              })}
              onOpenPromo={onOpenPromo}
              onDrillDown={drillDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
