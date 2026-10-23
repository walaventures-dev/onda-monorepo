'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ArmchairIcon as Armchair } from '@phosphor-icons/react/dist/csr/Armchair';
import { LockIcon as Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { UsersIcon as Users } from '@phosphor-icons/react/dist/csr/Users';
import type { PosSectionDto, PosTableDto } from '@onda/shared-types';
import { api } from './api';
import { SkeletonCards } from './Skeleton';

export type PosTablesPanelProps = {
  storeId: string;
  /** Token de CajaLink para el SSE (EventSource no lleva headers). */
  token?: string;
  /** Mesa ocupada: abrir su cuenta activa. */
  onOpenTab: (tabId: string) => void;
  /** Mesa libre: crear la cuenta con la mesa y los comensales. */
  onCreateTab: (input: {
    tableId: string;
    label: string;
    guestCount?: number | null;
  }) => Promise<string | void> | void;
};

const STATUS_STYLE: Record<
  PosTableDto['status'],
  { card: string; label: string; text: string }
> = {
  AVAILABLE: {
    card: 'border-[var(--onda-border)] bg-[var(--onda-card)]',
    label: 'Libre',
    text: 'text-[var(--onda-muted)]',
  },
  OCCUPIED: {
    card: 'border-amber-300 bg-[#FFF6E5]',
    label: 'Ocupada',
    text: 'text-amber-800',
  },
  CHECKOUT: {
    card: 'border-[var(--onda-primary-500)]/45 bg-[var(--onda-primary-50)]',
    label: 'Por cobrar',
    text: 'text-[var(--onda-primary-700)]',
  },
  BLOCKED: {
    card: 'border-[var(--onda-border)] bg-[var(--onda-bg)] opacity-70',
    label: 'Bloqueada',
    text: 'text-[var(--onda-muted)]',
  },
};

export function PosTablesPanel({
  storeId,
  token,
  onOpenTab,
  onCreateTab,
}: PosTablesPanelProps) {
  const [sections, setSections] = useState<PosSectionDto[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<PosTableDto | null>(null);
  const [guestCount, setGuestCount] = useState('2');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await api<PosSectionDto[]>(`/pos/stores/${storeId}/sections`);
    setSections(rows);
    setActiveSectionId((cur) =>
      cur && rows.some((s) => s.id === cur) ? cur : (rows[0]?.id ?? ''),
    );
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const qs = new URLSearchParams({ storeId });
    if (token) qs.set('token', token);
    const es = new EventSource(`/api/pos/stream?${qs.toString()}`);
    es.onmessage = () => void load().catch(() => undefined);
    return () => es.close();
  }, [storeId, token, load]);

  const active = sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null;

  async function confirmCreate() {
    if (!dialog || busy) return;
    const guests = Math.max(0, Math.round(Number(guestCount) || 0));
    setBusy(true);
    try {
      await onCreateTab({
        tableId: dialog.id,
        label: dialog.label,
        guestCount: guests > 0 ? guests : null,
      });
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {sections.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
                active?.id === s.id
                  ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                  : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
              }`}
              onClick={() => setActiveSectionId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <SkeletonCards count={6} />
      ) : sections.length === 0 ? (
        <div className="onda-card flex flex-col items-center gap-2 p-10 text-center">
          <Armchair
            className="h-8 w-8 text-[var(--onda-muted)]"
            weight="regular"
            aria-hidden
          />
          <p className="text-sm text-[var(--onda-muted)]">
            Aún no hay salones ni mesas. Créalos en la configuración del POS
            (Inventario → Salones y mesas).
          </p>
        </div>
      ) : active ? (
        active.tables.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--onda-muted)]">
            Este salón no tiene mesas.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {active.tables.map((table) => {
              const style = STATUS_STYLE[table.status];
              const clickable =
                table.status === 'AVAILABLE' ||
                Boolean(table.activeTab?.id);
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!clickable}
                  className={`flex aspect-square flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[0.97] disabled:cursor-not-allowed ${style.card}`}
                  onClick={() => {
                    if (table.activeTab?.id) onOpenTab(table.activeTab.id);
                    else if (table.status === 'AVAILABLE') {
                      setDialog(table);
                      setGuestCount(
                        table.activeTab?.guestCount ? String(table.activeTab.guestCount) : '2',
                      );
                    }
                  }}
                >
                  <span className="flex items-start justify-between gap-1">
                    <span className={`font-display text-base font-semibold ${style.text}`}>
                      {table.label}
                    </span>
                    {table.status === 'BLOCKED' ? (
                      <Lock
                        className="h-4 w-4 shrink-0 text-[var(--onda-muted)]"
                        weight="regular"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className={`text-[11px] font-medium ${style.text}`}>
                    {table.activeTab?.guestCount ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" weight="regular" aria-hidden />
                        {table.activeTab.guestCount}
                      </span>
                    ) : (
                      style.label
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : null}

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="onda-card w-full max-w-sm space-y-4 p-4">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Abrir mesa {dialog.label}
              </h3>
              <p className="text-sm text-[var(--onda-muted)]">
                ¿Cuántos comensales se sientan?
              </p>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--onda-muted)]">Comensales</span>
              <input
                className="onda-input w-full text-center text-lg font-semibold tabular-nums"
                inputMode="numeric"
                autoFocus
                value={guestCount}
                onChange={(e) =>
                  setGuestCount(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confirmCreate();
                }}
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                isDisabled={busy}
                onPress={() => setDialog(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                isDisabled={busy}
                onPress={() => void confirmCreate()}
              >
                {busy ? 'Abriendo…' : 'Abrir cuenta'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
