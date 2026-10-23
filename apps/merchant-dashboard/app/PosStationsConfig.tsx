'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  api,
  toast,
  OndaIcons,
  SkeletonList,
} from '@onda/shared-ui';
import type { PosStationDto } from '@onda/shared-types';
import { CookingPotIcon as CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';

/** Estaciones de preparación: cocina, barra, postres… */
export function PosStationsConfig({ storeId }: { storeId: string }) {
  const [stations, setStations] = useState<PosStationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await api<PosStationDto[]>(`/pos/stores/${storeId}/stations`);
    setStations(rows);
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

  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await load();
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo guardar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function addStation(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await run(
      () =>
        api(`/pos/stores/${storeId}/stations`, {
          method: 'POST',
          body: JSON.stringify({ name: trimmed }),
        }),
      'Estación creada',
    );
    setName('');
  }

  async function renameStation(stationId: string) {
    const next = (renames[stationId] ?? '').trim();
    if (!next) return;
    await run(
      () =>
        api(`/pos/stores/${storeId}/stations/${stationId}`, {
          method: 'POST',
          body: JSON.stringify({ name: next }),
        }),
      'Estación renombrada',
    );
    setRenames((prev) => ({ ...prev, [stationId]: '' }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Estaciones</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            Cocina, barra o postres. Cada producto puede ir a una estación y
            cada comanda se separa por estación.
          </p>
        </div>
        <form onSubmit={(e) => void addStation(e)} className="flex gap-2">
          <input
            className="onda-input min-w-[12rem]"
            placeholder="Nombre (ej. Cocina)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" isDisabled={busy || !name.trim()}>
            {OndaIcons.plus} Nueva estación
          </Button>
        </form>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : stations.length === 0 ? (
        <div className="onda-card flex flex-col items-center gap-2 p-10 text-center">
          <CookingPot
            className="h-8 w-8 text-[var(--onda-muted)]"
            weight="regular"
            aria-hidden
          />
          <p className="text-sm text-[var(--onda-muted)]">
            Sin estaciones. Sin estación, todas las comandas llegan como
            generales.
          </p>
        </div>
      ) : (
        <div className="onda-card divide-y divide-[var(--onda-border)]">
          {stations.map((station) => (
            <div
              key={station.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <CookingPot
                  className="h-4 w-4 text-[var(--onda-muted)]"
                  weight="regular"
                  aria-hidden
                />
                <span className="text-sm font-semibold text-[var(--onda-ink)]">
                  {station.name}
                </span>
              </div>
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameStation(station.id);
                }}
              >
                <input
                  className="onda-input w-40 py-1 text-xs"
                  placeholder="Renombrar"
                  value={renames[station.id] ?? ''}
                  onChange={(e) =>
                    setRenames((prev) => ({
                      ...prev,
                      [station.id]: e.target.value,
                    }))
                  }
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
                  disabled={busy || !(renames[station.id] ?? '').trim()}
                >
                  {OndaIcons.edit}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
