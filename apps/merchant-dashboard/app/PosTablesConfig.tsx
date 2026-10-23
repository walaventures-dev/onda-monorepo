'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  api,
  toast,
  OndaIcons,
  SkeletonList,
} from '@onda/shared-ui';
import type { PosSectionDto } from '@onda/shared-types';
import { ArmchairIcon as Armchair } from '@phosphor-icons/react/dist/csr/Armchair';
import { LockIcon as Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { LockOpenIcon as LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';

/** Configuración de salones (secciones) y mesas del restaurante. */
export function PosTablesConfig({ storeId }: { storeId: string }) {
  const [sections, setSections] = useState<PosSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionName, setSectionName] = useState('');
  const [tableLabels, setTableLabels] = useState<Record<string, string>>({});
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await api<PosSectionDto[]>(`/pos/stores/${storeId}/sections`);
    setSections(rows);
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

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    const name = sectionName.trim();
    if (!name) return;
    await run(
      () =>
        api(`/pos/stores/${storeId}/sections`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Salón creado',
    );
    setSectionName('');
  }

  async function addTable(sectionId: string) {
    const label = (tableLabels[sectionId] || '').trim();
    if (!label) return;
    await run(
      () =>
        api(`/pos/stores/${storeId}/tables`, {
          method: 'POST',
          body: JSON.stringify({ sectionId, label }),
        }),
      `Mesa ${label} creada`,
    );
    setTableLabels((prev) => ({ ...prev, [sectionId]: '' }));
  }

  async function renameSection(sectionId: string) {
    const name = (renames[sectionId] ?? '').trim();
    if (!name) return;
    await run(
      () =>
        api(`/pos/stores/${storeId}/sections/${sectionId}`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Salón renombrado',
    );
    setRenames((prev) => ({ ...prev, [sectionId]: '' }));
  }

  async function toggleBlocked(tableId: string, isBlocked: boolean) {
    await run(
      () =>
        api(`/pos/tables/${tableId}?storeId=${storeId}`, {
          method: 'POST',
          body: JSON.stringify({ isBlocked }),
        }),
      isBlocked ? 'Mesa bloqueada' : 'Mesa habilitada',
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Salones y mesas</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            Organiza el salón en secciones y mesas para el mapa del POS.
          </p>
        </div>
        <form onSubmit={(e) => void addSection(e)} className="flex gap-2">
          <input
            className="onda-input min-w-[12rem]"
            placeholder="Nombre del salón"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
          />
          <Button type="submit" isDisabled={busy || !sectionName.trim()}>
            {OndaIcons.plus} Nuevo salón
          </Button>
        </form>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : sections.length === 0 ? (
        <div className="onda-card flex flex-col items-center gap-2 p-10 text-center">
          <Armchair
            className="h-8 w-8 text-[var(--onda-muted)]"
            weight="regular"
            aria-hidden
          />
          <p className="text-sm text-[var(--onda-muted)]">
            Aún no hay salones. Crea el primero para empezar a agregar mesas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <section key={section.id} className="onda-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold">
                  {section.name}
                </h3>
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void renameSection(section.id);
                  }}
                >
                  <input
                    className="onda-input w-36 py-1 text-xs"
                    placeholder="Renombrar"
                    value={renames[section.id] ?? ''}
                    onChange={(e) =>
                      setRenames((prev) => ({
                        ...prev,
                        [section.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
                    disabled={busy || !(renames[section.id] ?? '').trim()}
                  >
                    {OndaIcons.edit}
                  </button>
                </form>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {section.tables.length === 0 ? (
                  <p className="text-xs text-[var(--onda-muted)]">
                    Sin mesas todavía.
                  </p>
                ) : (
                  section.tables.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleBlocked(table.id, !table.isBlocked)}
                      title={table.isBlocked ? 'Habilitar mesa' : 'Bloquear mesa'}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                        table.isBlocked
                          ? 'border-[var(--onda-border)] bg-[var(--onda-bg)] text-[var(--onda-muted)]'
                          : table.status === 'OCCUPIED'
                            ? 'border-amber-300 bg-[#FFF6E5] text-amber-800'
                            : table.status === 'CHECKOUT'
                              ? 'border-[var(--onda-primary-500)]/45 bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]'
                              : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-ink)]'
                      }`}
                    >
                      {table.isBlocked ? (
                        <Lock className="h-3.5 w-3.5" weight="regular" aria-hidden />
                      ) : (
                        <Armchair
                          className="h-3.5 w-3.5"
                          weight="regular"
                          aria-hidden
                        />
                      )}
                      {table.label}
                      {table.isBlocked ? (
                        <LockOpen
                          className="h-3 w-3 opacity-60"
                          weight="regular"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addTable(section.id);
                }}
              >
                <input
                  className="onda-input min-w-[8rem] flex-1"
                  placeholder="Nueva mesa (ej. M3)"
                  value={tableLabels[section.id] ?? ''}
                  onChange={(e) =>
                    setTableLabels((prev) => ({
                      ...prev,
                      [section.id]: e.target.value,
                    }))
                  }
                />
                <Button
                  type="submit"
                  variant="outline"
                  isDisabled={busy || !(tableLabels[section.id] ?? '').trim()}
                >
                  {OndaIcons.plus} Mesa
                </Button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
