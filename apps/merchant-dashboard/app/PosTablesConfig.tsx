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
import { LockIcon as Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { PicnicTableIcon as PicnicTable } from '@phosphor-icons/react/dist/csr/PicnicTable';
import { StarIcon as Star } from '@phosphor-icons/react/dist/csr/Star';
import { SunIcon as Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { TreeIcon as Tree } from '@phosphor-icons/react/dist/csr/Tree';
import { WineIcon as Wine } from '@phosphor-icons/react/dist/csr/Wine';
import { NamePickerModal, type NameOption } from './NamePickerModal';

const SALON_OPTIONS: NameOption[] = [
  { id: 'principal', label: 'Salón principal', icon: <PicnicTable className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'terraza', label: 'Terraza', icon: <Sun className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'barra', label: 'Barra', icon: <Wine className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'patio', label: 'Patio', icon: <Tree className="h-5 w-5" weight="regular" aria-hidden /> },
  { id: 'vip', label: 'VIP', icon: <Star className="h-5 w-5" weight="regular" aria-hidden /> },
];

/** Siguiente número de mesa secuencial (M1, M2, …), como en un POS real. */
function nextTableLabel(tables: { label: string }[]): string {
  const nums = tables
    .map((t) => /^M(\d+)$/.exec(t.label)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : tables.length + 1;
  return `M${next}`;
}

/** Configuración de salones (secciones) y mesas del restaurante. */
export function PosTablesConfig({ storeId }: { storeId: string }) {
  const [sections, setSections] = useState<PosSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkCounts, setBulkCounts] = useState<Record<string, string>>({});
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

  async function addSection(name: string) {
    const ok = await run(
      () =>
        api(`/pos/stores/${storeId}/sections`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Salón creado',
    );
    if (ok) setPickerOpen(false);
  }

  /** Agrega la siguiente mesa en secuencia (M1, M2, …). */
  async function addTable(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const label = nextTableLabel(section.tables);
    await run(
      () =>
        api(`/pos/stores/${storeId}/tables`, {
          method: 'POST',
          body: JSON.stringify({ sectionId, label }),
        }),
      `${label} agregada`,
    );
  }

  /** Deja el salón con `target` mesas en total: crea las que falten (nunca borra). */
  async function generateTables(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const target = Number(bulkCounts[sectionId] ?? '');
    if (!Number.isInteger(target) || target < 1) {
      toast.warning('Indica cuántas mesas tiene el salón');
      return;
    }
    if (target > 200) {
      toast.warning('Máximo 200 mesas por salón');
      return;
    }
    const missing = target - section.tables.length;
    if (missing <= 0) {
      toast.warning(
        `El salón ya tiene ${section.tables.length} mesas. Para quitar, elimínalas una a una.`,
      );
      return;
    }
    const ok = await run(
      () =>
        api(`/pos/stores/${storeId}/tables/bulk`, {
          method: 'POST',
          body: JSON.stringify({ sectionId, count: missing }),
        }),
      `${missing} mesas creadas`,
    );
    if (ok) setBulkCounts((prev) => ({ ...prev, [sectionId]: '' }));
  }

  async function removeTable(tableId: string, label: string) {
    await run(
      () =>
        api(`/pos/tables/${tableId}/remove?storeId=${storeId}`, {
          method: 'POST',
        }),
      `${label} eliminada`,
    );
  }

  async function renameSection(sectionId: string) {
    const name = (renames[sectionId] ?? '').trim();
    if (!name) return;
    const ok = await run(
      () =>
        api(`/pos/stores/${storeId}/sections/${sectionId}`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Salón renombrado',
    );
    if (ok) {
      setRenames((prev) => ({ ...prev, [sectionId]: '' }));
      setRenamingId(null);
    }
  }

  async function removeSection(sectionId: string) {
    const ok = await run(
      () =>
        api(`/pos/stores/${storeId}/sections/${sectionId}/remove`, {
          method: 'POST',
        }),
      'Salón eliminado',
    );
    if (ok) setConfirmDeleteId(null);
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
            Crea salones y agrega sus mesas. Haz click en una mesa para
            bloquearla o habilitarla.
          </p>
        </div>
        <Button type="button" onPress={() => setPickerOpen(true)}>
          {OndaIcons.plus} Nuevo salón
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--onda-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)]" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          Ocupada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--onda-primary-500)]" />
          Por pagar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--onda-border)]" />
          <Lock className="h-3 w-3" weight="regular" aria-hidden />
          Bloqueada
        </span>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : sections.length === 0 ? (
        <div className="onda-card flex flex-col items-center gap-2 p-10 text-center">
          <PicnicTable
            className="h-8 w-8 text-[var(--onda-muted)]"
            weight="regular"
            aria-hidden
          />
          <p className="text-sm text-[var(--onda-muted)]">
            Aún no hay salones. Crea el primero para empezar a agregar mesas.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-1"
            onPress={() => setPickerOpen(true)}
          >
            {OndaIcons.plus} Crear salón
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <section key={section.id} className="onda-card p-4">
              <div className="flex items-center justify-between gap-2">
                {renamingId === section.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renameSection(section.id);
                    }}
                  >
                    <input
                      className="onda-input min-w-0 flex-1 py-1 text-sm"
                      value={renames[section.id] ?? ''}
                      onChange={(e) =>
                        setRenames((prev) => ({
                          ...prev,
                          [section.id]: e.target.value,
                        }))
                      }
                      autoFocus
                      aria-label="Nuevo nombre del salón"
                    />
                    <button
                      type="submit"
                      className="inline-flex shrink-0 items-center rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
                      disabled={busy || !(renames[section.id] ?? '').trim()}
                      aria-label="Guardar nombre"
                    >
                      {OndaIcons.check}
                    </button>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)]"
                      onClick={() => {
                        setRenamingId(null);
                        setRenames((prev) => ({ ...prev, [section.id]: '' }));
                      }}
                      aria-label="Cancelar"
                    >
                      {OndaIcons.close}
                    </button>
                  </form>
                ) : (
                  <h3 className="min-w-0 truncate font-display text-base font-semibold">
                    {section.name}
                  </h3>
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs tabular-nums text-[var(--onda-muted)]">
                    {section.tables.length}{' '}
                    {section.tables.length === 1 ? 'mesa' : 'mesas'}
                  </span>
                  {renamingId !== section.id ? (
                    confirmDeleteId === section.id ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-[var(--onda-danger)]/40 bg-[var(--onda-danger)]/10 px-2 py-1 text-xs font-medium text-[var(--onda-danger)] transition hover:bg-[var(--onda-danger)]/20 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void removeSection(section.id)}
                        >
                          ¿Eliminar salón?
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)]"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancelar eliminación"
                        >
                          {OndaIcons.close}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)]"
                          onClick={() => {
                            setRenamingId(section.id);
                            setRenames((prev) => ({
                              ...prev,
                              [section.id]: section.name,
                            }));
                          }}
                          aria-label={`Renombrar ${section.name}`}
                        >
                          {OndaIcons.edit}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-[var(--onda-border)] px-2 py-1 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-danger)]/40 hover:text-[var(--onda-danger)]"
                          onClick={() => setConfirmDeleteId(section.id)}
                          aria-label={`Eliminar ${section.name}`}
                        >
                          {OndaIcons.trash}
                        </button>
                      </>
                    )
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {section.tables.length === 0 ? (
                  <p className="w-full rounded-xl border border-dashed border-[var(--onda-border)] px-3 py-4 text-center text-xs text-[var(--onda-muted)]">
                    Sin mesas. Indica cuántas tiene el salón y pulsa Generar, o
                    agrégalas una a una.
                  </p>
                ) : (
                  section.tables.map((table) => (
                    <span key={table.id} className="group relative">
                      <button
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
                          <PicnicTable
                            className="h-3.5 w-3.5"
                            weight="regular"
                            aria-hidden
                          />
                        )}
                        {table.label}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeTable(table.id, table.label)}
                        title={`Eliminar ${table.label}`}
                        aria-label={`Eliminar ${table.label}`}
                        className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] shadow-sm transition hover:border-[var(--onda-danger)] hover:text-[var(--onda-danger)] disabled:opacity-50 group-hover:flex"
                      >
                        {OndaIcons.close}
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="onda-input w-20 px-3 py-1.5 text-sm tabular-nums"
                  placeholder="Cant."
                  value={bulkCounts[section.id] ?? ''}
                  onChange={(e) =>
                    setBulkCounts((prev) => ({
                      ...prev,
                      [section.id]: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  aria-label={`Cantidad total de mesas de ${section.name}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="px-3 py-1.5 text-xs"
                  isDisabled={busy || !(bulkCounts[section.id] ?? '').trim()}
                  onPress={() => void generateTables(section.id)}
                >
                  Generar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto px-3 py-1.5 text-xs"
                  isDisabled={busy}
                  onPress={() => void addTable(section.id)}
                >
                  {OndaIcons.plus} Mesa ({nextTableLabel(section.tables)})
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}

      {pickerOpen ? (
        <NamePickerModal
          title="Nuevo salón"
          description="Elige un nombre predefinido o escribe el tuyo."
          options={SALON_OPTIONS}
          otherPlaceholder="Nombre del salón (ej. Mezzanine)"
          submitLabel="Crear salón"
          busy={busy}
          onClose={() => setPickerOpen(false)}
          onSubmit={(name) => void addSection(name)}
        />
      ) : null}
    </div>
  );
}
