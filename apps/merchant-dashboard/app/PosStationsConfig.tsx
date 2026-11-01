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
import { ArmchairIcon as Armchair } from '@phosphor-icons/react/dist/csr/Armchair';
import { BathtubIcon as Bathtub } from '@phosphor-icons/react/dist/csr/Bathtub';
import { BedIcon as Bed } from '@phosphor-icons/react/dist/csr/Bed';
import { CakeIcon as Cake } from '@phosphor-icons/react/dist/csr/Cake';
import { CoffeeIcon as Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
import { FlameIcon as Flame } from '@phosphor-icons/react/dist/csr/Flame';
import { ShowerIcon as Shower } from '@phosphor-icons/react/dist/csr/Shower';
import { hasDining, useBusinessType } from '../lib/businessType';
import { NamePickerModal, type NameOption } from './NamePickerModal';

const RESTAURANT_STATION_OPTIONS: NameOption[] = [
  { id: 'cocina', label: 'Cocina', icon: <CookingPot className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'barra', label: 'Barra', icon: <Coffee className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'postres', label: 'Postres', icon: <Cake className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'parrilla', label: 'Parrilla', icon: <Flame className="h-5 w-5" weight="regular" aria-hidden /> },
];

const BEAUTY_STATION_OPTIONS: NameOption[] = [
  { id: 'silla', label: 'Silla', icon: <Armchair className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'cabina', label: 'Cabina', icon: <Bathtub className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'camilla', label: 'Camilla', icon: <Bed className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'lavacabezas', label: 'Lavacabezas', icon: <Shower className="h-5 w-5" weight="regular" aria-hidden /> },
];

/**
 * Estaciones de preparación o de servicio: cocina/barra en restauración,
 * sillas/cabinas/camillas en belleza. Cada ítem puede ir a una estación y
 * cada comanda se separa por estación.
 */
export function PosStationsConfig({ storeId }: { storeId: string }) {
  const { businessType } = useBusinessType();
  const beauty = !hasDining(businessType);
  const StationIcon = beauty ? Armchair : CookingPot;
  const [stations, setStations] = useState<PosStationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  async function run(
    action: () => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await load();
      return true;
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo guardar',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addStation(name: string) {
    const ok = await run(
      () =>
        api(`/pos/stores/${storeId}/stations`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Estación creada',
    );
    if (ok) setPickerOpen(false);
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
            {beauty
              ? 'Sillas, cabinas o camillas. Cada servicio puede ir a una estación y cada comanda se separa por estación.'
              : 'Cocina, barra o postres. Cada producto puede ir a una estación y cada comanda se separa por estación.'}
          </p>
        </div>
        <Button type="button" onPress={() => setPickerOpen(true)}>
          {OndaIcons.plus} Nueva estación
        </Button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : stations.length === 0 ? (
        <div className="onda-card flex flex-col items-center gap-2 p-10 text-center">
          <StationIcon
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
                <StationIcon
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

      {pickerOpen ? (
        <NamePickerModal
          title="Nueva estación"
          description={
            beauty
              ? 'Sillas, cabinas o camillas. Elige uno o escribe el tuyo.'
              : 'Puntos de preparación. Elige uno o escribe el tuyo.'
          }
          options={
            beauty ? BEAUTY_STATION_OPTIONS : RESTAURANT_STATION_OPTIONS
          }
          otherPlaceholder={
            beauty ? 'Nombre de la estación (ej. Silla 1)' : 'Nombre de la estación (ej. Cocina caliente)'
          }
          submitLabel="Crear estación"
          busy={busy}
          onClose={() => setPickerOpen(false)}
          onSubmit={(name) => void addStation(name)}
        />
      ) : null}
    </div>
  );
}
