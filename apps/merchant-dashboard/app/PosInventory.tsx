'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  api,
  ImageUploadField,
  toast,
  OndaSelect,
  OndaIcons,
  SkeletonList,
  SkeletonTable,
} from '@onda/shared-ui';
import { formatCop, formatMoneyInput, parseMoneyInput } from '@onda/shared-utils';
import type {
  PosAddonDto,
  PosItemDto,
  PosItemHistoryDto,
  PosItemKind,
  PosStationDto,
} from '@onda/shared-types';
import { UploadSimpleIcon as UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { hasDining, hasStations, useBusinessType } from '../lib/businessType';

const CSV_TEMPLATE = `nombre,precio,tipo,stock
Consulta general,80000,servicio,
Producto A,25000,producto,40
Producto B,15000,producto,100
`;

type CsvRow = {
  kind: PosItemKind;
  name: string;
  price: number;
  trackStock: boolean;
  stockQty: number | null;
};

type InventorySection = 'catalog' | 'addons';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === ',' || ch === ';') && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parsePriceCell(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

function parseKindCell(raw: string): PosItemKind {
  const v = raw.trim().toLowerCase();
  if (v === 'servicio' || v === 'service' || v === 's') return 'SERVICE';
  return 'PRODUCT';
}

function parseCsvInventory(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], errors: ['El archivo está vacío'] };

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = headerCells.some((h) =>
    ['nombre', 'name', 'precio', 'price', 'tipo', 'kind', 'stock'].includes(h),
  );
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let idxName = 0;
  let idxPrice = 1;
  let idxKind = 2;
  let idxStock = 3;
  if (hasHeader) {
    idxName = headerCells.findIndex((h) => h === 'nombre' || h === 'name');
    idxPrice = headerCells.findIndex((h) => h === 'precio' || h === 'price');
    idxKind = headerCells.findIndex((h) => h === 'tipo' || h === 'kind');
    idxStock = headerCells.findIndex((h) => h === 'stock' || h === 'cantidad');
    if (idxName < 0) idxName = 0;
    if (idxPrice < 0) idxPrice = 1;
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, i) => {
    const cells = splitCsvLine(line);
    const name = (cells[idxName] || '').replace(/^"|"$/g, '').trim();
    const price = parsePriceCell(cells[idxPrice] || '');
    const kind = idxKind >= 0 ? parseKindCell(cells[idxKind] || '') : 'PRODUCT';
    const stockRaw = idxStock >= 0 ? (cells[idxStock] || '').trim() : '';
    const trackStock = kind === 'PRODUCT' && stockRaw !== '';
    const stockQty = trackStock
      ? Math.max(0, Math.round(Number(stockRaw.replace(/\D/g, '') || 0)))
      : null;
    const rowNum = i + (hasHeader ? 2 : 1);

    if (!name) {
      errors.push(`Fila ${rowNum}: falta el nombre`);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Fila ${rowNum}: precio inválido`);
      return;
    }
    rows.push({ kind, name, price, trackStock, stockQty });
  });

  return { rows, errors };
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-inventario-onda.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function InventoryModal({
  title,
  description,
  onClose,
  children,
  wide,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="onda-dialog-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-modal-title"
        className={`onda-dialog w-full ${wide ? 'max-w-lg' : 'max-w-sm'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onda-dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id="inventory-modal-title" className="onda-dialog-title">
              {title}
            </h2>
            {description ? (
              <p className="onda-dialog-body mt-1 !mb-0">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
            onClick={onClose}
          >
            {OndaIcons.close} Cerrar
          </button>
        </header>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const HISTORY_FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  price: 'Precio',
  imageUrl: 'Imagen',
  trackStock: 'Control de stock',
  stockQty: 'Stock',
  isActive: 'Activo',
  sortOrder: 'Orden',
  stationId: 'Estación',
};

function formatHistoryValue(field: string, value: string | null | undefined) {
  if (value == null || value === '') return '—';
  if (field === 'price') {
    const n = Number(value);
    return Number.isFinite(n) ? formatCop(n) : value;
  }
  if (field === 'isActive' || field === 'trackStock') {
    return value === 'true' ? 'Sí' : 'No';
  }
  return value;
}

function ItemHistoryModal({
  storeId,
  item,
  stations,
  onClose,
}: {
  storeId: string;
  item: PosItemDto;
  stations: PosStationDto[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PosItemHistoryDto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<PosItemHistoryDto[]>(`/pos/stores/${storeId}/items/${item.id}/history`)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, item.id]);

  return (
    <InventoryModal
      title={`Historial: ${item.name}`}
      description="Cambios guardados en este ítem."
      onClose={onClose}
    >
      {rows === null ? (
        <p className="py-6 text-center text-sm text-[var(--onda-muted)]">
          Cargando…
        </p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-[var(--onda-muted)]">
          No se pudo cargar el historial.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--onda-muted)]">
          Este ítem aún no tiene cambios registrados.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => {
            const fieldLabel = HISTORY_FIELD_LABELS[row.field] ?? row.field;
            const stationName = (id: string) =>
              stations.find((s) => s.id === id)?.name;
            const oldValue =
              row.field === 'stationId' && row.oldValue
                ? (stationName(row.oldValue) ?? 'Sin estación')
                : formatHistoryValue(row.field, row.oldValue);
            const newValue =
              row.field === 'stationId' && row.newValue
                ? (stationName(row.newValue) ?? 'Sin estación')
                : formatHistoryValue(row.field, row.newValue);
            return (
              <li
                key={row.id}
                className="rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)]/40 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{fieldLabel}</span>
                  <span className="text-xs text-[var(--onda-muted)]">
                    {new Date(row.createdAt).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                {row.field === 'imageUrl' ? (
                  <div className="mt-2 flex items-center gap-3">
                    {row.oldValue ? (
                      <img
                        src={row.oldValue}
                        alt="Imagen anterior"
                        className="h-14 w-14 rounded-lg border border-[var(--onda-border)] object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-[var(--onda-border)] text-[10px] uppercase tracking-wide text-[var(--onda-muted)]">
                        Sin foto
                      </span>
                    )}
                    <span className="text-[var(--onda-primary)]">→</span>
                    {row.newValue ? (
                      <img
                        src={row.newValue}
                        alt="Imagen nueva"
                        className="h-14 w-14 rounded-lg border border-[var(--onda-border)] object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-[var(--onda-border)] text-[10px] uppercase tracking-wide text-[var(--onda-muted)]">
                        Sin foto
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 break-words text-[var(--onda-muted)]">
                    <span>{oldValue}</span>
                    <span className="mx-1.5 text-[var(--onda-primary)]">→</span>
                    <span className="text-[var(--onda-ink)]">{newValue}</span>
                  </p>
                )}
                <p className="mt-0.5 text-xs text-[var(--onda-muted)]">
                  {row.changedByEmail ?? 'Sesión de caja'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </InventoryModal>
  );
}

function ItemOptionsModal({
  storeId,
  item,
  stations,
  allAddons,
  stationTitle,
  onSaved,
  onClose,
}: {
  storeId: string;
  item: PosItemDto;
  stations: PosStationDto[];
  allAddons: PosAddonDto[];
  stationTitle: string;
  onSaved: (item: PosItemDto) => void;
  onClose: () => void;
}) {
  return (
    <InventoryModal
      title={`Opciones: ${item.name}`}
      description="Variantes, adicionales y estación de preparación."
      onClose={onClose}
      wide
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        {stations.length ? (
          <ItemStationEditor
            storeId={storeId}
            item={item}
            stations={stations}
            title={stationTitle}
            onSaved={onSaved}
          />
        ) : null}
        <ItemOptionsEditor
          storeId={storeId}
          item={item}
          allAddons={allAddons}
          onSaved={onSaved}
        />
      </div>
    </InventoryModal>
  );
}

function ItemOptionsEditor({
  storeId,
  item,
  allAddons,
  onSaved,
}: {
  storeId: string;
  item: PosItemDto;
  allAddons: PosAddonDto[];
  onSaved: (item: PosItemDto) => void;
}) {
  const [variantDrafts, setVariantDrafts] = useState<
    Array<{ id?: string; name: string; price: string; isDefault: boolean }>
  >(
    (item.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      price: String(v.price),
      isDefault: v.isDefault,
    })),
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(
    (item.addons || []).map((a) => a.id),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const withVariants = await api<PosItemDto>(
        `/pos/stores/${storeId}/items/${item.id}/variants`,
        {
          method: 'POST',
          body: JSON.stringify({
            variants: variantDrafts
              .filter((v) => v.name.trim())
              .map((v) => ({
                id: v.id,
                name: v.name.trim(),
                price: Number(parseMoneyInput(v.price) || 0),
                isDefault: v.isDefault,
              })),
          }),
        },
      );
      const updated = await api<PosItemDto>(
        `/pos/stores/${storeId}/items/${item.id}/addons`,
        {
          method: 'POST',
          body: JSON.stringify({ addonIds: selectedAddonIds }),
        },
      );
      onSaved({ ...withVariants, ...updated, addons: updated.addons });
      toast.success('Opciones guardadas');
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo guardar',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--onda-ink)]">
          {OndaIcons.nXm} Variantes
        </p>
        <p className="mb-2 text-xs text-[var(--onda-muted)]">
          Opciones excluyentes (tamaño, duración, etc.). El precio de la variante reemplaza el
          precio base al vender.
        </p>
        <div className="space-y-2">
          {variantDrafts.map((v, idx) => (
            <div key={v.id || idx} className="flex flex-wrap items-center gap-2">
              <input
                className="onda-input min-w-[8rem] flex-1"
                placeholder="Nombre"
                value={v.name}
                onChange={(e) =>
                  setVariantDrafts((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
              <input
                className="onda-input w-28 tabular-nums"
                placeholder="Precio"
                value={formatMoneyInput(v.price)}
                onChange={(e) =>
                  setVariantDrafts((rows) =>
                    rows.map((r, i) =>
                      i === idx ? { ...r, price: parseMoneyInput(e.target.value) } : r,
                    ),
                  )
                }
              />
              <label className="flex items-center gap-1 text-xs text-[var(--onda-muted)]">
                <input
                  type="radio"
                  name={`default-${item.id}`}
                  checked={v.isDefault}
                  onChange={() =>
                    setVariantDrafts((rows) =>
                      rows.map((r, i) => ({ ...r, isDefault: i === idx })),
                    )
                  }
                />
                Predet.
              </label>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs text-[var(--onda-danger)] transition hover:border-[var(--onda-danger)]/40 hover:bg-[var(--onda-danger)]/10"
                aria-label="Quitar variante"
                title="Quitar variante"
                onClick={() =>
                  setVariantDrafts((rows) => rows.filter((_, i) => i !== idx))
                }
              >
                {OndaIcons.trash}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--onda-primary)]"
          onClick={() =>
            setVariantDrafts((rows) => [
              ...rows,
              {
                name: '',
                price: String(item.price),
                isDefault: rows.length === 0,
              },
            ])
          }
        >
          {OndaIcons.plus} Variante
        </button>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--onda-ink)]">
          {OndaIcons.accumulate} Adicionales
        </p>
        <p className="mb-2 text-xs text-[var(--onda-muted)]">
          Opcionales al vender. Créalos en la pestaña Adicionales y asócialos aquí.
        </p>
        {allAddons.filter((a) => a.isActive).length === 0 ? (
          <p className="text-xs text-[var(--onda-muted)]">Aún no hay adicionales.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allAddons
              .filter((a) => a.isActive)
              .map((a) => {
                const on = selectedAddonIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      on
                        ? 'border-[var(--onda-primary)] bg-[var(--onda-primary-100)] text-[var(--onda-ink)]'
                        : 'border-[var(--onda-border)] text-[var(--onda-muted)]'
                    }`}
                    onClick={() =>
                      setSelectedAddonIds((ids) =>
                        on ? ids.filter((id) => id !== a.id) : [...ids, a.id],
                      )
                    }
                  >
                    {a.name}
                    {a.price > 0 ? ` · ${formatCop(a.price)}` : ' · gratis'}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <div className="onda-dialog-footer flex justify-end gap-2 border-t border-[var(--onda-border)] pt-3">
        <Button type="button" isDisabled={saving} onPress={() => void save()}>
          {saving ? 'Guardando…' : (
            <>
              {OndaIcons.save} Guardar opciones
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ItemStationEditor({
  storeId,
  item,
  stations,
  title,
  onSaved,
}: {
  storeId: string;
  item: PosItemDto;
  stations: PosStationDto[];
  title: string;
  onSaved: (item: PosItemDto) => void;
}) {
  const [value, setValue] = useState(item.stationId ?? '');
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const previous = item.stationId ?? '';
    if (next === previous || saving) return;
    setValue(next);
    setSaving(true);
    try {
      const updated = await api<PosItemDto>(
        `/pos/stores/${storeId}/items/${item.id}`,
        { method: 'POST', body: JSON.stringify({ stationId: next }) },
      );
      onSaved(updated);
      toast.success('Estación actualizada');
    } catch (e) {
      setValue(previous);
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo guardar',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!stations.length) return null;

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--onda-ink)]">
        {OndaIcons.near} {title}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <OndaSelect
            aria-label="Estación del ítem"
            value={value}
            onChange={(v) => void change(v)}
            options={[
              { id: '', label: 'Sin estación' },
              ...stations.map((s) => ({ id: s.id, label: s.name })),
            ]}
          />
        </div>
        {saving ? (
          <span className="text-xs text-[var(--onda-muted)]">Guardando…</span>
        ) : null}
      </div>
    </div>
  );
}

export function PosInventory({ storeId }: { storeId: string }) {
  const { businessType } = useBusinessType();
  const diningModules = hasDining(businessType);
  const stationModules = hasStations(businessType);
  const beautyStation = stationModules && !diningModules;
  // Los adicionales son un sub-módulo de Ítems y solo aplica a restauración.
  const [section, setSection] = useState<InventorySection>('catalog');
  const [items, setItems] = useState<PosItemDto[]>([]);
  const [addons, setAddons] = useState<PosAddonDto[]>([]);
  const [stations, setStations] = useState<PosStationDto[]>([]);
  const [modal, setModal] = useState<'item' | 'addon' | null>(null);
  const [editingItem, setEditingItem] = useState<PosItemDto | null>(null);
  const [historyItem, setHistoryItem] = useState<PosItemDto | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [kind, setKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [stationId, setStationId] = useState('');
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonImageUrl, setAddonImageUrl] = useState('');
  const [editingAddon, setEditingAddon] = useState<PosAddonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [optionsItem, setOptionsItem] = useState<PosItemDto | null>(null);
  const [csvMenuOpen, setCsvMenuOpen] = useState(false);
  const csvMenuRef = useRef<HTMLDivElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!csvMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!csvMenuRef.current?.contains(e.target as Node)) setCsvMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [csvMenuOpen]);

  const canTrackStock = kind === 'PRODUCT';

  async function load() {
    setLoading(true);
    try {
      const [itemRows, addonRows, stationRows] = await Promise.all([
        api<PosItemDto[]>(`/pos/stores/${storeId}/items`),
        api<PosAddonDto[]>(`/pos/stores/${storeId}/addons`),
        api<PosStationDto[]>(`/pos/stores/${storeId}/stations`),
      ]);
      setItems(itemRows);
      setAddons(addonRows);
      setStations(stationRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (storeId) void load();
  }, [storeId]);

  function resetItemForm() {
    setName('');
    setPrice('');
    setKind('PRODUCT');
    setTrackStock(false);
    setStockQty('0');
    setImageUrl('');
    setStationId('');
  }

  function resetAddonForm() {
    setAddonName('');
    setAddonPrice('');
    setAddonImageUrl('');
    setEditingAddon(null);
  }

  function openAddonModal(addon?: PosAddonDto) {
    if (addon) {
      setEditingAddon(addon);
      setAddonName(addon.name);
      setAddonPrice(String(addon.price));
      setAddonImageUrl(addon.imageUrl ?? '');
    } else {
      setEditingAddon(null);
      resetAddonForm();
    }
    setModal('addon');
  }

  function closeModal() {
    setModal(null);
    setEditingItem(null);
    resetItemForm();
    resetAddonForm();
  }

  function openItemModal(item?: PosItemDto) {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setPrice(String(item.price));
      setKind(item.kind);
      setTrackStock(item.trackStock);
      setStockQty(String(item.stockQty ?? 0));
      setImageUrl(item.imageUrl ?? '');
      setStationId(item.stationId ?? '');
    } else {
      setEditingItem(null);
      resetItemForm();
    }
    setModal('item');
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const tracking = canTrackStock && trackStock;
      await api(`/pos/stores/${storeId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          name,
          price: Number(parseMoneyInput(price) || 0),
          trackStock: tracking,
          stockQty: tracking ? Number(stockQty) : null,
          imageUrl: imageUrl.trim() || null,
          stationId: stationId || null,
        }),
      });
      toast.success('Producto agregado');
      closeModal();
      setSection('catalog');
      await load();
    } catch (err) {
      toast.danger('Error', {
        description: err instanceof Error ? err.message : 'No se pudo agregar',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const tracking = editingItem.kind === 'PRODUCT' && trackStock;
      const updated = await api<PosItemDto>(
        `/pos/stores/${storeId}/items/${editingItem.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            price: Number(parseMoneyInput(price) || 0),
            trackStock: tracking,
            stockQty: tracking ? Number(stockQty) : null,
            imageUrl: imageUrl.trim() || null,
            stationId: stationId || null,
          }),
        },
      );
      setItems((rows) =>
        rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
      );
      toast.success('Ítem actualizado');
      closeModal();
    } catch (err) {
      toast.danger('Error', {
        description: err instanceof Error ? err.message : 'No se pudo guardar',
      });
    } finally {
      setSaving(false);
    }
  }

  async function addAddon(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/pos/stores/${storeId}/addons`, {
        method: 'POST',
        body: JSON.stringify({
          name: addonName,
          price: Number(parseMoneyInput(addonPrice) || 0),
          imageUrl: addonImageUrl.trim() || null,
        }),
      });
      toast.success('Adicional creado');
      closeModal();
      setSection('addons');
      await load();
    } catch (err) {
      toast.danger('Error', {
        description: err instanceof Error ? err.message : 'No se pudo crear',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAddon) return;
    setSaving(true);
    try {
      const updated = await api<PosAddonDto>(
        `/pos/stores/${storeId}/addons/${editingAddon.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: addonName,
            price: Number(parseMoneyInput(addonPrice) || 0),
            imageUrl: addonImageUrl.trim() || null,
          }),
        },
      );
      setAddons((rows) =>
        rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
      );
      toast.success('Adicional actualizado');
      closeModal();
    } catch (err) {
      toast.danger('Error', {
        description: err instanceof Error ? err.message : 'No se pudo guardar',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: PosItemDto) {
    await api(`/pos/stores/${storeId}/items/${item.id}`, {
      method: 'POST',
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await load();
  }

  async function toggleAddon(addon: PosAddonDto) {
    await api(`/pos/stores/${storeId}/addons/${addon.id}`, {
      method: 'POST',
      body: JSON.stringify({ isActive: !addon.isActive }),
    });
    await load();
  }

  async function onCsvFile(file: File | null) {
    if (!file) return;
    setCsvBusy(true);
    try {
      const text = await file.text();
      const { rows, errors } = parseCsvInventory(text);
      if (!rows.length) {
        toast.danger('CSV sin ítems válidos', {
          description: errors.slice(0, 3).join(' · ') || 'Revisa la plantilla',
        });
        return;
      }
      const res = await api<{
        created: number;
        skipped: number;
        errors: Array<{ row: number; message: string }>;
      }>(`/pos/stores/${storeId}/items/bulk`, {
        method: 'POST',
        body: JSON.stringify({ items: rows }),
      });
      const warn = [
        ...errors,
        ...(res.errors || []).map((e) => `Fila ${e.row}: ${e.message}`),
      ];
      toast.success(
        `${res.created} ítem${res.created === 1 ? '' : 's'} cargado${res.created === 1 ? '' : 's'}`,
        { description: warn.length ? `${warn.length} fila(s) con error` : undefined },
      );
      setSection('catalog');
      await load();
    } catch (e) {
      toast.danger('No se pudo importar', {
        description: e instanceof Error ? e.message : 'Intenta de nuevo',
      });
    } finally {
      setCsvBusy(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  function optionsSummary(item: PosItemDto) {
    const v = item.variants?.length ?? 0;
    const a = item.addons?.length ?? 0;
    if (!v && !a) return 'Sin opciones';
    return [
      v ? `${v} variante${v === 1 ? '' : 's'}` : null,
      a ? `${a} adic.` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Inventario</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            {diningModules
              ? 'Catálogo para vender: ítems, variantes y adicionales.'
              : 'Catálogo para vender: ítems y variantes.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onCsvFile(e.target.files?.[0] || null)}
          />
          <div className="relative" ref={csvMenuRef}>
            <Button
              type="button"
              variant="outline"
              isDisabled={csvBusy}
              onPress={() => setCsvMenuOpen((open) => !open)}
              aria-expanded={csvMenuOpen}
              aria-haspopup="menu"
            >
              {csvBusy ? (
                'Importando…'
              ) : (
                <>
                  <UploadSimple
                    className="h-3 w-3 shrink-0"
                    weight="regular"
                    aria-hidden
                  />{' '}
                  CSV {OndaIcons.chevronDown}
                </>
              )}
            </Button>
            {csvMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--onda-bg)]"
                  onClick={() => {
                    setCsvMenuOpen(false);
                    downloadTemplate();
                  }}
                >
                  {OndaIcons.download} Descargar plantilla
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--onda-bg)]"
                  onClick={() => {
                    setCsvMenuOpen(false);
                    csvInputRef.current?.click();
                  }}
                >
                  <UploadSimple
                    className="h-3 w-3 shrink-0"
                    weight="regular"
                    aria-hidden
                  />
                  Cargar CSV
                </button>
              </div>
            ) : null}
          </div>
          {diningModules ? (
            <Button type="button" variant="outline" onPress={() => openAddonModal()}>
              {OndaIcons.plus} Nuevo adicional
            </Button>
          ) : null}
          <Button type="button" onPress={() => setModal('item')}>
            {OndaIcons.plus} Nuevo ítem
          </Button>
        </div>
      </div>

      {diningModules ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              section === 'catalog'
                ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
            }`}
            onClick={() => setSection('catalog')}
          >
            {OndaIcons.product} Catálogo ({items.length})
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              section === 'addons'
                ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
            }`}
            onClick={() => setSection('addons')}
          >
            {OndaIcons.accumulate} Adicionales ({addons.length})
          </button>
        </div>
      ) : null}

      {section === 'catalog' ? (
        loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : (
        <div className="onda-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] text-left text-[var(--onda-muted)]">
              <tr>
                <th className="px-4 py-2">Foto</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Precio</th>
                <th className="px-4 py-2">Opciones</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="text-sm text-[var(--onda-muted)]">Aún no hay ítems.</p>
                    <Button
                      type="button"
                      className="mt-3"
                      onPress={() => setModal('item')}
                    >
                      {OndaIcons.plus} Crear el primero
                    </Button>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="group border-b border-[var(--onda-border)] transition-colors hover:bg-[var(--onda-bg)]/80">
                      <td className="px-4 py-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[var(--onda-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className={item.isActive ? '' : 'text-[var(--onda-muted)]'}>
                          {item.name}
                        </span>
                        {!item.isActive ? (
                          <span className="ml-2 rounded-full bg-[var(--onda-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                            Inactivo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {item.kind === 'SERVICE' ? 'Servicio' : 'Producto'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCop(item.price)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--onda-muted)]">
                          {optionsSummary(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {item.trackStock ? (item.stockQty ?? 0) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs font-medium text-[var(--onda-ink)] transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary-700)]"
                            aria-label="Opciones del ítem"
                            title="Opciones del ítem"
                            onClick={() => setOptionsItem(item)}
                          >
                            {OndaIcons.gear}
                          </button>
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs font-medium text-[var(--onda-ink)] transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary-700)]"
                            aria-label="Editar ítem"
                            title="Editar ítem"
                            onClick={() => openItemModal(item)}
                          >
                            {OndaIcons.edit}
                          </button>
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs font-medium text-[var(--onda-ink)] transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary-700)]"
                            aria-label="Historial de cambios"
                            title="Historial de cambios"
                            onClick={() => setHistoryItem(item)}
                          >
                            {OndaIcons.history}
                          </button>
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs font-medium text-[var(--onda-ink)] transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary-700)]"
                            aria-label={item.isActive ? 'Desactivar ítem' : 'Activar ítem'}
                            title={item.isActive ? 'Desactivar ítem' : 'Activar ítem'}
                            onClick={() => void toggleActive(item)}
                          >
                            {OndaIcons.power}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        )
      ) : loading ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="onda-card overflow-hidden">
          {addons.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--onda-muted)]">
                Los adicionales son extras opcionales al vender (precio 0 = gratis).
              </p>
              <Button type="button" className="mt-3" onPress={() => openAddonModal()}>
                {OndaIcons.plus} Crear adicional
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--onda-border)]">
              {addons.map((a) => (
                <li
                  key={a.id}
                  className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--onda-bg)]/80"
                >
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 text-left"
                    title="Editar adicional"
                    onClick={() => openAddonModal(a)}
                  >
                    {a.imageUrl ? (
                      <img
                        src={a.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--onda-bg)] text-xs font-semibold text-[var(--onda-muted)]">
                        {a.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className={a.isActive ? '' : 'text-[var(--onda-muted)] line-through'}>
                      {a.name}{' '}
                      <span className="tabular-nums text-[var(--onda-muted)]">
                        {a.price > 0 ? formatCop(a.price) : 'gratis'}
                      </span>
                      {!a.isActive ? (
                        <span className="ml-2 rounded-full bg-[var(--onda-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)] no-underline">
                          Inactivo
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-1.5 text-xs font-medium text-[var(--onda-ink)] opacity-100 transition hover:border-[var(--onda-primary-500)]/35 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary-700)] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    aria-label={a.isActive ? 'Desactivar adicional' : 'Activar adicional'}
                    title={a.isActive ? 'Desactivar adicional' : 'Activar adicional'}
                    onClick={() => void toggleAddon(a)}
                  >
                    {OndaIcons.power}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal === 'item' ? (
        <InventoryModal
          title={editingItem ? 'Editar ítem' : 'Nuevo ítem'}
          description="Producto o servicio del catálogo de venta."
          onClose={closeModal}
          wide
        >
          <form onSubmit={editingItem ? saveItem : addItem} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-24 shrink-0 space-y-1 text-sm">
                <span className="block text-[var(--onda-muted)]">Foto</span>
                <ImageUploadField
                  label=""
                  hint="JPG o PNG"
                  value={imageUrl}
                  onChange={setImageUrl}
                  aspectClass="aspect-square h-24 w-24"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--onda-muted)]">Nombre</span>
                  <input
                    className="onda-input w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--onda-muted)]">Precio (COP)</span>
                  <div className="onda-input-group">
                    <span className="onda-input-group__prefix">$</span>
                    <input
                      className="onda-input w-full tabular-nums"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatMoneyInput(price)}
                      onChange={(e) => setPrice(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      required
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className={`grid gap-3 ${editingItem ? '' : 'sm:grid-cols-2'}`}>
              {editingItem ? null : (
                <div className="space-y-1 text-sm">
                  <span className="text-[var(--onda-muted)]">Tipo</span>
                  <div className="flex gap-2" role="group" aria-label="Tipo">
                    {(
                      [
                        { id: 'PRODUCT', label: 'Producto' },
                        { id: 'SERVICE', label: 'Servicio' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={kind === opt.id}
                        onClick={() => {
                          setKind(opt.id);
                          if (opt.id === 'SERVICE') setTrackStock(false);
                        }}
                        className={`flex-1 rounded-[0.85rem] border px-3 py-[0.7rem] text-[0.9375rem] font-medium transition ${
                          kind === opt.id
                            ? 'border-[var(--onda-bridge)] bg-[var(--onda-bridge)] text-white'
                            : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)]/60 hover:text-[var(--onda-ink)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1 text-sm">
                <span className="text-[var(--onda-muted)]">
                  {editingItem ? 'Stock' : 'Stock inicial'}
                </span>
                <div className="flex gap-2">
                  <input
                    className="onda-input w-full min-w-0 flex-1 tabular-nums"
                    type="text"
                    inputMode="numeric"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ''))}
                    disabled={!canTrackStock || !trackStock}
                    placeholder="0"
                    aria-label="Stock inicial"
                  />
                  <label
                    htmlFor="track-stock-modal"
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[0.85rem] border px-3 text-xs font-medium transition ${
                      canTrackStock
                        ? 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                        : 'cursor-not-allowed border-[var(--onda-border)]/60 text-[var(--onda-muted)]/50'
                    }`}
                  >
                    <input
                      id="track-stock-modal"
                      type="checkbox"
                      className="rounded border-[var(--onda-border)]"
                      checked={canTrackStock && trackStock}
                      disabled={!canTrackStock}
                      onChange={(e) => setTrackStock(e.target.checked)}
                    />
                    Controlar stock
                  </label>
                </div>
              </div>
            </div>

            {stationModules ? (
              <div className="space-y-1 text-sm">
                <span className="text-[var(--onda-muted)]">
                  {beautyStation ? 'Estación' : 'Estación de preparación'}
                </span>
                <OndaSelect
                  aria-label="Estación"
                  value={stationId}
                  onChange={(v) => setStationId(v)}
                  options={[
                    { id: '', label: 'Sin estación (comanda general)' },
                    ...stations.map((s) => ({ id: s.id, label: s.name })),
                  ]}
                />
                <p className="text-[11px] text-[var(--onda-muted)]">
                  {beautyStation
                    ? 'Los servicios con estación van a su comanda (silla 1, cabina…).'
                    : 'Los productos con estación van a su comanda (cocina, barra…).'}
                </p>
              </div>
            ) : null}

            <div className="onda-dialog-footer flex justify-end gap-2 pt-2">
              <button type="button" className="onda-dialog-btn inline-flex items-center gap-1" onClick={closeModal}>
                {OndaIcons.close} Cancelar
              </button>
              <Button type="submit" isDisabled={saving}>
                {saving ? 'Guardando…' : (
                  <>
                    {OndaIcons.plus} {editingItem ? 'Guardar cambios' : 'Agregar'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </InventoryModal>
      ) : null}

      {optionsItem ? (
        <ItemOptionsModal
          storeId={storeId}
          item={optionsItem}
          stations={stations}
          allAddons={addons}
          stationTitle={
            beautyStation ? 'Estación' : 'Estación de preparación'
          }
          onSaved={(updated) => {
            setItems((rows) =>
              rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
            );
          }}
          onClose={() => setOptionsItem(null)}
        />
      ) : null}

      {historyItem ? (
        <ItemHistoryModal
          storeId={storeId}
          item={historyItem}
          stations={stations}
          onClose={() => setHistoryItem(null)}
        />
      ) : null}

      {modal === 'addon' ? (
        <InventoryModal
          title={editingAddon ? 'Editar adicional' : 'Nuevo adicional'}
          description="Extra opcional al vender. Precio 0 = gratis."
          onClose={closeModal}
        >
          <form onSubmit={editingAddon ? saveAddon : addAddon} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-24 shrink-0 space-y-1 text-sm">
                <span className="block text-[var(--onda-muted)]">Foto</span>
                <ImageUploadField
                  label=""
                  hint="JPG o PNG"
                  value={addonImageUrl}
                  onChange={setAddonImageUrl}
                  aspectClass="aspect-square h-24 w-24"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--onda-muted)]">Nombre</span>
                  <input
                    className="onda-input w-full"
                    value={addonName}
                    onChange={(e) => setAddonName(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--onda-muted)]">Precio (COP)</span>
                  <div className="onda-input-group">
                    <span className="onda-input-group__prefix">$</span>
                    <input
                      className="onda-input w-full tabular-nums"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatMoneyInput(addonPrice)}
                      onChange={(e) => setAddonPrice(parseMoneyInput(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </label>
              </div>
            </div>
            <div className="onda-dialog-footer flex justify-end gap-2 pt-2">
              <button type="button" className="onda-dialog-btn inline-flex items-center gap-1" onClick={closeModal}>
                {OndaIcons.close} Cancelar
              </button>
              <Button type="submit" isDisabled={saving}>
                {saving ? 'Guardando…' : (
                  <>
                    {OndaIcons.plus} {editingAddon ? 'Guardar cambios' : 'Crear'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </InventoryModal>
      ) : null}
    </div>
  );
}
