"use client";

import { useEffect, useMemo, useState } from "react";
import { api, GradientButton, OndaIcons } from "@onda/shared-ui";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function CartillaCalendar({
  storeId,
  onOpen,
  onCreate,
  onClose,
}: {
  storeId: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!storeId) return;
    void api(`/cartillas/calendar?storeId=${storeId}&year=${year}`).then(setData);
  }, [storeId, year]);

  const blocks = useMemo(() => {
    const list = (data?.cartillas || []).filter((c: any) => !c.isDefault);
    return list.map((c: any) => {
      const start = c.startsAt ? new Date(c.startsAt) : new Date(year, 0, 1);
      const end = c.endsAt ? new Date(c.endsAt) : new Date(year, 11, 31);
      const startMonth = start.getFullYear() === year ? start.getMonth() : 0;
      const endMonth = end.getFullYear() === year ? end.getMonth() : 11;
      return { ...c, startMonth, endMonth };
    });
  }, [data, year]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
      >
        ← Promociones
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Calendario {year}</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            La cartilla permanente cubre el año. Las ocasionales se superponen en su rango.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm"
            onClick={() => setYear((y) => y - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm"
            onClick={() => setYear((y) => y + 1)}
          >
            →
          </button>
          <GradientButton type="button" onClick={onCreate}>
            {OndaIcons.plus}
            Nueva cartilla
          </GradientButton>
        </div>
      </div>

      <div className="onda-card overflow-x-auto p-4">
        <div className="grid min-w-[40rem] grid-cols-12 gap-1 text-center text-[11px] font-medium text-[var(--onda-muted)]">
          {MONTHS.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>
        <div className="relative mt-3 min-w-[40rem] space-y-2">
          <div className="rounded-full bg-[var(--onda-violet-soft)] px-3 py-2 text-xs text-[var(--onda-violet)]">
            Permanente
          </div>
          {blocks.map((c: any) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="grid w-full cursor-pointer grid-cols-12 gap-1"
            >
              {MONTHS.map((_, i) => {
                const on = i >= c.startMonth && i <= c.endMonth;
                return (
                  <div
                    key={i}
                    className={`h-8 rounded-lg ${
                      on
                        ? "bg-[var(--onda-violet)] text-[10px] leading-8 text-white"
                        : "bg-[var(--onda-bg)]"
                    }`}
                  >
                    {on && i === c.startMonth ? c.name : ""}
                  </div>
                );
              })}
            </button>
          ))}
          {!blocks.length ? (
            <p className="text-sm text-[var(--onda-muted)]">
              Aún no hay cartillas ocasionales este año.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
