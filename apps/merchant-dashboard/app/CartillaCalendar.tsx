"use client";

import { useEffect, useMemo, useState } from "react";
import { api, GradientButton, OndaIcons } from "@onda/shared-ui";

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

function parseDay(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}

function endOfYear(year: number) {
  return new Date(year, 11, 31);
}

function daysInYear(year: number) {
  return (Date.UTC(year, 11, 31) - Date.UTC(year, 0, 1)) / MS_DAY + 1;
}

function dayIndex(d: Date, year: number) {
  const start = Date.UTC(year, 0, 1);
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day - start) / MS_DAY);
}

function formatDay(d: Date) {
  return d
    .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
    .replace(".", "");
}

function formatRange(start: Date, end: Date) {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function clipToYear(start: Date, end: Date, year: number) {
  const from = startOfYear(year);
  const to = endOfYear(year);
  if (end < from || start > to) return null;
  return {
    start: start < from ? from : start,
    end: end > to ? to : end,
  };
}

function kindClass(kind: Kind) {
  if (kind === "active") return "bg-[var(--onda-violet)] text-white";
  if (kind === "scheduled") {
    return "bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]";
  }
  return "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]";
}

function kindDot(kind: Kind) {
  if (kind === "active") return "bg-[var(--onda-violet)]";
  if (kind === "scheduled") return "bg-[var(--onda-sky)]";
  return "bg-[var(--onda-violet-soft)]";
}

function buildSegments(
  year: number,
  cartillas: CalCartilla[],
  activeId?: string,
): Segment[] {
  const dim = daysInYear(year);
  const yearStart = startOfYear(year);
  const yearEnd = endOfYear(year);
  const base = cartillas.find((c) => c.isDefault) || null;

  const occasionals = cartillas
    .filter((c) => !c.isDefault && c.status !== "ENDED" && c.startsAt && c.endsAt)
    .map((c) => {
      const clipped = clipToYear(parseDay(c.startsAt!), parseDay(c.endsAt!), year);
      if (!clipped) return null;
      const kind: Kind = c.id === activeId ? "active" : "scheduled";
      return { cartilla: c, kind, ...clipped };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const toSeg = (
    cartilla: CalCartilla,
    kind: Kind,
    start: Date,
    end: Date,
    key: string,
  ): Segment => {
    const startIdx = Math.max(0, dayIndex(start, year));
    const endIdx = Math.min(dim - 1, dayIndex(end, year));
    const span = Math.max(1, endIdx - startIdx + 1);
    return {
      key,
      cartilla,
      kind,
      start,
      end,
      left: (startIdx / dim) * 100,
      width: (span / dim) * 100,
    };
  };

  const segments: Segment[] = [];
  let cursor = yearStart;
  occasionals.forEach((occ, i) => {
    if (base && occ.start > cursor) {
      segments.push(
        toSeg(base, "default", cursor, addDays(occ.start, -1), `base-${i}`),
      );
    }
    segments.push(
      toSeg(occ.cartilla, occ.kind, occ.start, occ.end, occ.cartilla.id),
    );
    cursor = addDays(occ.end, 1);
  });
  if (base && cursor <= yearEnd) {
    segments.push(toSeg(base, "default", cursor, yearEnd, "base-end"));
  }
  if (!segments.length && base) {
    segments.push(toSeg(base, "default", yearStart, yearEnd, "base-year"));
  }
  return segments;
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
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [data, setData] = useState<{
    cartillas?: CalCartilla[];
    activeId?: string;
  } | null>(null);

  useEffect(() => {
    if (!storeId) return;
    void api(`/cartillas/calendar?storeId=${storeId}&year=${year}`).then(setData);
  }, [storeId, year]);

  const cartillas = data?.cartillas || [];
  const segments = useMemo(
    () => buildSegments(year, cartillas, data?.activeId),
    [cartillas, data?.activeId, year],
  );
  const months = useMemo(() => {
    const dim = daysInYear(year);
    let acc = 0;
    return MONTHS.map((label, i) => {
      const days = new Date(year, i + 1, 0).getDate();
      const left = (acc / dim) * 100;
      const width = (days / dim) * 100;
      acc += days;
      return { label, left, width };
    });
  }, [year]);

  const todayPct = useMemo(() => {
    if (year !== yearNow) return null;
    const dim = daysInYear(year);
    return ((dayIndex(new Date(), year) + 0.5) / dim) * 100;
  }, [year, yearNow]);

  const occasionals = segments.filter((s) => s.kind !== "default");

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Calendario {year}
          </h2>
          <p className="text-sm text-[var(--onda-muted)]">
            Solo una cartilla vigente a la vez. La base cubre el año; una
            ocasional la reemplaza día a día.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm"
            onClick={() => setYear((y) => y - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm"
            onClick={() => setYear((y) => y + 1)}
          >
            →
          </button>
          {onCreate ? (
            <GradientButton type="button" onClick={onCreate}>
              {OndaIcons.plus}
              Nueva cartilla
            </GradientButton>
          ) : null}
        </div>
      </div>

      {segments.length ? (
        <div className="onda-card overflow-x-auto p-4">
          <div className="relative min-w-[40rem]">
            <div className="relative h-5">
              {months.map((m) => (
                <div
                  key={m.label}
                  className="absolute top-0 text-[11px] font-medium text-[var(--onda-muted)]"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="relative mt-1 h-11 overflow-hidden rounded-xl bg-[var(--onda-bg)]">
              {months.map((m) => (
                <div
                  key={`tick-${m.label}`}
                  className="absolute inset-y-0 w-px bg-[var(--onda-border)]"
                  style={{ left: `${m.left}%` }}
                />
              ))}
              {segments.map((seg) => {
                const showDates = seg.width >= 12 && seg.kind !== "default";
                const showName = seg.width >= 7;
                return (
                  <button
                    key={seg.key}
                    type="button"
                    title={`${seg.cartilla.name}${
                      seg.kind === "default"
                        ? ""
                        : ` · ${formatRange(seg.start, seg.end)}`
                    }`}
                    onClick={() => onOpen(seg.cartilla.id)}
                    className={`absolute inset-y-1 cursor-pointer overflow-hidden rounded-lg px-2 text-left ${kindClass(
                      seg.kind,
                    )}`}
                    style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                  >
                    {showName ? (
                      <span className="block truncate text-[11px] font-medium leading-4">
                        {seg.kind === "default" ? "Base" : seg.cartilla.name}
                      </span>
                    ) : null}
                    {showDates ? (
                      <span className="block truncate text-[10px] leading-4 opacity-80">
                        {formatRange(seg.start, seg.end)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {todayPct != null ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--onda-ink)]"
                  style={{ left: `${todayPct}%` }}
                  title="Hoy"
                />
              ) : null}
            </div>
          </div>

          {occasionals.length ? (
            <ul className="mt-3 space-y-1.5">
              {occasionals.map((seg) => (
                <li key={seg.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(seg.cartilla.id)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-1 text-left text-sm hover:bg-[var(--onda-bg)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-sm ${kindDot(seg.kind)}`}
                      />
                      <span className="truncate font-medium">
                        {seg.cartilla.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--onda-muted)]">
                        {seg.kind === "active" ? "Vigente" : "Programada"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--onda-muted)]">
                      {formatRange(seg.start, seg.end)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--onda-muted)]">
              Sin ocasionales este año. La cartilla base cubre todos los días.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
