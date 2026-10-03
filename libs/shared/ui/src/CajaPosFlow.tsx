'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { BankIcon as Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { MoneyIcon as Money } from '@phosphor-icons/react/dist/csr/Money';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import type { ReactNode } from 'react';
import {
  formatCop,
  formatMoneyInput,
  isCompletePhoneMask,
  parseMoneyInput,
  runDeviceAction,
  toE164Colombia,
} from '@onda/shared-utils';
import type {
  PosItemDto,
  PosPaymentMethodDto,
  PosSaleDto,
  PosTabDto,
} from '@onda/shared-types';
import { api } from './api';
import { OndaIcons } from './icons';
import { PhoneInput } from './PhoneInput';
import { SkeletonCards, SkeletonList } from './Skeleton';

type View = 'list' | 'cart' | 'grid' | 'identify' | 'pay';

const SCREEN_TEXT = 'Pasa el QR de tu pase Onda en el sensor';

function productCount(tab: PosTabDto) {
  return tab.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function tabTitle(tab: PosTabDto) {
  return tab.customerName?.trim() || tab.label;
}

function needsPicker(item: PosItemDto) {
  return (item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0;
}

function itemSearchIndex(item: PosItemDto) {
  return [
    item.name,
    item.externalSku,
    String(item.price),
    formatCop(item.price),
    ...(item.variants || []).flatMap((v) => [v.name, String(v.price), formatCop(v.price)]),
    ...(item.addons || []).flatMap((a) => [a.name, String(a.price), formatCop(a.price)]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function lineLabel(line: PosTabDto['lines'][number]) {
  return [line.item?.name ?? 'Ítem', line.variantName, (line.addons || []).map((a) => a.name).join(', ')]
    .filter(Boolean)
    .join(' · ');
}

function paymentIcon(key: string): ReactNode {
  const cls = 'h-5 w-5';
  if (key === 'card') return <CreditCard className={cls} weight="regular" aria-hidden />;
  if (key === 'transfer') return <Bank className={cls} weight="regular" aria-hidden />;
  return <Money className={cls} weight="regular" aria-hidden />;
}

function customerScreenJpeg(message: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#052DDE';
  ctx.fillRect(0, 0, 480, 480);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 40px system-ui, sans-serif';
  const words = message.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > 400 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const start = 240 - ((lines.length - 1) * 52) / 2;
  lines.forEach((line, i) => ctx.fillText(line, 240, start + i * 52));
  return canvas.toDataURL('image/jpeg', 0.82);
}

function ItemPhoto({ item }: { item: PosItemDto }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt=""
        draggable={false}
        className="pointer-events-none aspect-square w-full object-cover"
      />
    );
  }
  return (
    <div className="pointer-events-none flex aspect-square w-full items-center justify-center bg-[var(--onda-bg)]">
      <span className="font-display text-2xl font-semibold text-[var(--onda-muted)]">
        {item.name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function PickerModal({
  item,
  withNote,
  busy,
  onCancel,
  onConfirm,
}: {
  item: PosItemDto;
  withNote: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (opts: { variantId?: string; addonIds: string[]; note?: string }) => void;
}) {
  const variants = item.variants || [];
  const addons = item.addons || [];
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.isDefault)?.id || variants[0]?.id || '',
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const base = variants.find((v) => v.id === variantId)?.price ?? item.price;
  const extras = addons.filter((a) => addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="onda-card w-full max-w-md space-y-4 p-4">
        <h3 className="font-display text-lg font-semibold">{item.name}</h3>
        {variants.length ? (
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  variantId === v.id
                    ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)]'
                    : 'border-[var(--onda-border)]'
                }`}
                onClick={() => setVariantId(v.id)}
              >
                {v.name} · {formatCop(v.price)}
              </button>
            ))}
          </div>
        ) : null}
        {addons.length ? (
          <div className="flex flex-wrap gap-2">
            {addons.map((a) => {
              const on = addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    on
                      ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)]'
                      : 'border-[var(--onda-border)]'
                  }`}
                  onClick={() =>
                    setAddonIds((ids) => (on ? ids.filter((id) => id !== a.id) : [...ids, a.id]))
                  }
                >
                  {a.name}
                  {a.price > 0 ? ` · ${formatCop(a.price)}` : ''}
                </button>
              );
            })}
          </div>
        ) : null}
        {withNote ? (
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--onda-muted)]">Comentario</span>
            <input
              className="onda-input w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sin cebolla, para llevar…"
            />
          </label>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold tabular-nums">{formatCop(base + extras)}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onPress={onCancel} isDisabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              isDisabled={busy || (variants.length > 0 && !variantId) || (withNote && !note.trim())}
              onPress={() =>
                onConfirm({
                  variantId: variantId || undefined,
                  addonIds,
                  note: note.trim() || undefined,
                })
              }
            >
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CajaPosFlow({
  storeId,
  storeName,
  ondaValue,
  onAcumular,
  onLogout,
  logoutBusy,
}: {
  storeId: string;
  storeName?: string;
  ondaValue?: number | null;
  onAcumular: () => void;
  onLogout?: () => void | Promise<void>;
  logoutBusy?: boolean;
}) {
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<PosItemDto[]>([]);
  const [tabs, setTabs] = useState<PosTabDto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PosPaymentMethodDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuItem, setMenuItem] = useState<PosItemDto | null>(null);
  const [picker, setPicker] = useState<{ item: PosItemDto; withNote: boolean } | null>(null);
  const [noteItem, setNoteItem] = useState<PosItemDto | null>(null);
  const [noteText, setNoteText] = useState('');
  const [phone, setPhone] = useState('');
  const [methodKey, setMethodKey] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const skipSyncUntil = useRef(0);
  const identifyToken = useRef(0);
  const qrAbort = useRef<AbortController | null>(null);
  const longPress = useRef(false);
  const pressTimer = useRef<number | null>(null);

  const tab = useMemo(
    () => tabs.find((t) => t.id === selectedId) ?? null,
    [tabs, selectedId],
  );

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (!item.isActive) return false;
      if (!tokens.length) return true;
      const index = itemSearchIndex(item);
      return tokens.every((token) => index.includes(token));
    });
  }, [items, search]);

  const upsert = useCallback((next: PosTabDto) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === next.id);
      if (idx === -1) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }, []);

  const loadTabs = useCallback(async () => {
    if (Date.now() < skipSyncUntil.current) return;
    const rows = await api<PosTabDto[]>(
      `/pos/tabs?storeId=${storeId}&status=OPEN,CHECKOUT`,
    );
    setTabs(rows);
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rows, methods] = await Promise.all([
          api<PosItemDto[]>(`/pos/stores/${storeId}/items`),
          api<PosPaymentMethodDto[]>(`/pos/stores/${storeId}/payment-methods`),
          loadTabs(),
        ]);
        if (cancelled) return;
        setItems(rows.filter((i) => i.isActive));
        const active = methods.filter((m) => m.isActive);
        setPaymentMethods(active);
        if (active[0]) setMethodKey(active[0].key);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, loadTabs]);

  useEffect(() => {
    const es = new EventSource(`/api/pos/stream?storeId=${storeId}`);
    es.onmessage = () => void loadTabs();
    return () => es.close();
  }, [storeId, loadTabs]);

  function markLocal() {
    skipSyncUntil.current = Date.now() + 800;
  }

  async function createTab() {
    markLocal();
    const created = await api<PosTabDto>(`/pos/tabs?storeId=${storeId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    upsert(created);
    setSelectedId(created.id);
    setSearch('');
    setView('grid');
  }

  async function addLine(
    item: PosItemDto,
    opts?: { variantId?: string; addonIds?: string[]; note?: string },
  ) {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/lines?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            itemId: item.id,
            quantity: 1,
            variantId: opts?.variantId,
            addonIds: opts?.addonIds ?? [],
            note: opts?.note,
          }),
        },
      );
      upsert(updated);
      setPicker(null);
      setNoteItem(null);
      setNoteText('');
      setMenuItem(null);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo agregar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function setLineQty(lineId: string, quantity: number) {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/lines?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({ lineId, quantity }),
        },
      );
      upsert(updated);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo actualizar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function clearItem(item: PosItemDto) {
    if (!tab || busy) return;
    const lines = tab.lines.filter((l) => l.itemId === item.id);
    setMenuItem(null);
    if (!lines.length) return;
    setBusy(true);
    markLocal();
    try {
      let current = tab;
      for (const line of lines) {
        current = await api<PosTabDto>(
          `/pos/tabs/${current.id}/lines?storeId=${storeId}`,
          { method: 'POST', body: JSON.stringify({ lineId: line.id, quantity: 0 }) },
        );
      }
      upsert(current);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo borrar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function restarItem(item: PosItemDto) {
    const line = [...(tab?.lines || [])].reverse().find((l) => l.itemId === item.id);
    setMenuItem(null);
    if (!line) return;
    await setLineQty(line.id, Math.max(0, line.quantity - 1));
  }

  function openAdd(item: PosItemDto, withNote: boolean) {
    setMenuItem(null);
    if (needsPicker(item) || withNote && needsPicker(item)) {
      setPicker({ item, withNote });
      return;
    }
    if (withNote) {
      setNoteItem(item);
      setNoteText('');
      return;
    }
    void addLine(item);
  }

  async function ensureOpen() {
    if (!tab || tab.status === 'OPEN') return tab;
    markLocal();
    const updated = await api<PosTabDto>(
      `/pos/tabs/${tab.id}/reopen?storeId=${storeId}`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    upsert(updated);
    return updated;
  }

  async function voidTab() {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      await api(`/pos/tabs/${tab.id}/void?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTabs((prev) => prev.filter((t) => t.id !== tab.id));
      setSelectedId(null);
      setView('list');
      toast.success('Cuenta cancelada');
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo cancelar',
      });
    } finally {
      setBusy(false);
    }
  }

  function stopIdentify() {
    identifyToken.current += 1;
    qrAbort.current?.abort();
    qrAbort.current = null;
  }

  const showCustomerScreen = useCallback(async () => {
    const image = customerScreenJpeg(SCREEN_TEXT);
    try {
      await runDeviceAction({
        method: 'secondaryScreenImage',
        body: image ? { image } : undefined,
      });
      await runDeviceAction({
        method: 'secondaryScreenString',
        body: { text: 'Pasa tu QR Onda' },
      });
    } catch {
      /* sin dispositivo: el cajero sigue con el teléfono */
    }
  }, []);

  const finishIdentify = useCallback(
    async (updated: PosTabDto) => {
      stopIdentify();
      upsert(updated);
      setPhone('');
      setIdentifying(false);
      setView('pay');
      toast.success('Cliente identificado', {
        description: updated.customerName || 'Listo para cobrar',
      });
    },
    [upsert],
  );

  useEffect(() => {
    if (view !== 'identify' || !selectedId) return;
    const token = ++identifyToken.current;
    const ctrl = new AbortController();
    qrAbort.current = ctrl;
    void showCustomerScreen();
    void (async () => {
      try {
        const result = await runDeviceAction(
          { method: 'readQr', body: { timeout: 60 }, slow: true },
          70_000,
          ctrl.signal,
        );
        if (identifyToken.current !== token) return;
        const payload = result.envelope.response?.trim();
        if (result.envelope.code !== 0 || !payload) return;
        setIdentifying(true);
        const updated = await api<PosTabDto>(
          `/pos/tabs/${selectedId}/link-pass?storeId=${storeId}`,
          { method: 'POST', body: JSON.stringify({ payload }) },
        );
        if (identifyToken.current !== token) return;
        await finishIdentify(updated);
      } catch (e) {
        if (ctrl.signal.aborted || identifyToken.current !== token) return;
        const offline = e instanceof TypeError;
        if (!offline && e instanceof Error && !/abort/i.test(e.message)) {
          toast.danger('QR', { description: e.message });
        }
      } finally {
        if (identifyToken.current === token) setIdentifying(false);
      }
    })();
    return () => {
      identifyToken.current += 1;
      ctrl.abort();
    };
  }, [view, selectedId, storeId, showCustomerScreen, finishIdentify]);

  async function linkPhone() {
    if (!tab || identifying || !isCompletePhoneMask(phone)) return;
    const token = ++identifyToken.current;
    qrAbort.current?.abort();
    setIdentifying(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/link-phone?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({ phone: toE164Colombia(phone) }),
        },
      );
      if (identifyToken.current !== token) return;
      await finishIdentify(updated);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo identificar',
      });
      setIdentifying(false);
    }
  }

  async function cobrar() {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      let current = tab;
      if (current.status === 'OPEN') {
        current = await api<PosTabDto>(
          `/pos/tabs/${current.id}/checkout?storeId=${storeId}`,
          { method: 'POST', body: JSON.stringify({}) },
        );
        upsert(current);
      }
      const body: { methodKey: string; cashReceived?: number } = { methodKey };
      if (methodKey === 'cash') {
        body.cashReceived = Number(parseMoneyInput(cashReceived) || 0);
      }
      const sale = await api<PosSaleDto>(
        `/pos/tabs/${current.id}/pay?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setTabs((prev) => prev.filter((t) => t.id !== current.id));
      setSelectedId(null);
      setCashReceived('');
      setView('list');
      toast.success('Venta registrada');
      const text = [
        storeName || 'Onda',
        ...sale.lines.map(
          (l) => `${l.quantity} ${l.name} ${formatCop(l.quantity * l.unitPrice)}`,
        ),
        `Total ${formatCop(sale.total)}`,
        sale.ondasGranted > 0 ? `Ondas +${sale.ondasGranted}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const printed = await runDeviceAction({
          method: 'printString',
          body: { text },
        });
        if (printed.envelope.code !== 0) {
          toast.danger('Impresión', {
            description: printed.envelope.message || 'La venta quedó registrada',
          });
        }
      } catch {
        toast.danger('Impresión', {
          description: 'Sin dispositivo. La venta quedó registrada.',
        });
      }
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo cobrar',
      });
    } finally {
      setBusy(false);
    }
  }

  const changeDue =
    tab && methodKey === 'cash'
      ? Math.max(0, Number(parseMoneyInput(cashReceived) || 0) - tab.total)
      : 0;

  const header = (
    <header className="flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-sm font-semibold text-[var(--onda-ink)]">
        {storeName?.trim() || 'Caja'}
      </p>
      {onLogout ? (
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={logoutBusy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--onda-muted)] disabled:opacity-50"
        >
          {OndaIcons.logout}
          Salir
        </button>
      ) : null}
    </header>
  );

  return (
    <div className="flex min-h-[70dvh] flex-col gap-3">
      {header}

      {view === 'list' ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <SkeletonList />
            ) : tabs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--onda-muted)]">
                Sin cuentas abiertas
              </p>
            ) : (
              <ul className="space-y-2">
                {tabs.map((row) => {
                  const count = productCount(row);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="onda-card flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={() => {
                          setSelectedId(row.id);
                          setView('cart');
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--onda-ink)]">
                            {tabTitle(row)}
                          </span>
                          <span className="text-xs text-[var(--onda-muted)]">
                            {count} producto{count === 1 ? '' : 's'}
                            {row.status === 'CHECKOUT' ? ' · Por cobrar' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCop(row.total)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <Button type="button" onPress={() => void createTab()} isDisabled={busy}>
              {OndaIcons.plus} Nueva cuenta
            </Button>
            <button
              type="button"
              onClick={onAcumular}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--onda-sky)] px-4 text-sm font-semibold text-[var(--onda-ink)]"
            >
              <QrCode className="h-4 w-4" weight="regular" aria-hidden />
              Acumular
            </button>
          </div>
        </>
      ) : null}

      {view === 'cart' && tab ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--onda-muted)]"
            onClick={() => setView('list')}
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Cuentas
          </button>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{tabTitle(tab)}</h2>
            <span className="text-lg font-semibold tabular-nums">{formatCop(tab.total)}</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {tab.lines.length === 0 ? (
              <li className="py-8 text-center text-sm text-[var(--onda-muted)]">
                Esta cuenta no tiene productos.
              </li>
            ) : (
              tab.lines.map((line) => (
                <li
                  key={line.id}
                  className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{lineLabel(line)}</p>
                    <p className="shrink-0 text-sm tabular-nums">
                      {formatCop(line.quantity * line.unitPrice)}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {line.quantity} × {formatCop(line.unitPrice)}
                    {line.note ? ` · ${line.note}` : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
          <div className="grid grid-cols-3 gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={busy}
              onClick={() => void voidTab()}
              className="rounded-full border border-[var(--onda-danger)]/30 px-3 py-2 text-sm font-semibold text-[var(--onda-danger)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void ensureOpen().then(() => {
                  setSearch('');
                  setView('grid');
                });
              }}
              className="rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Editar
            </button>
            <Button
              type="button"
              isDisabled={busy || tab.lines.length === 0}
              onPress={() => setView('identify')}
            >
              Completar
            </Button>
          </div>
        </>
      ) : null}

      {view === 'grid' && tab ? (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--onda-muted)]"
              onClick={() => setView('cart')}
            >
              <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
              Cuenta
            </button>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              className="onda-input min-w-0 flex-1"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <SkeletonCards count={6} />
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--onda-muted)]">
                {search.trim() ? 'Ningún producto coincide.' : 'No hay productos activos.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="onda-card overflow-hidden p-0 text-left"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={() => {
                      longPress.current = false;
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                      pressTimer.current = window.setTimeout(() => {
                        longPress.current = true;
                        setMenuItem(item);
                      }, 450);
                    }}
                    onPointerUp={() => {
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                    }}
                    onPointerLeave={() => {
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                    }}
                    onClick={() => {
                      if (longPress.current) {
                        longPress.current = false;
                        return;
                      }
                      openAdd(item, false);
                    }}
                  >
                    <ItemPhoto item={item} />
                    <span className="block space-y-0.5 p-3">
                      <span className="line-clamp-2 block text-sm font-semibold">{item.name}</span>
                      <span className="block text-sm tabular-nums text-[var(--onda-primary-500)]">
                        {formatCop(item.price)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setView('cart')}
            className="rounded-full bg-[var(--onda-ink)] px-4 py-3 text-sm font-semibold text-white"
          >
            Ver cuenta · {formatCop(tab.total)} · {productCount(tab)} producto
            {productCount(tab) === 1 ? '' : 's'}
          </button>
        </>
      ) : null}

      {view === 'identify' && tab ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--onda-muted)]"
            onClick={() => {
              stopIdentify();
              setView('cart');
            }}
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Cuenta
          </button>
          <h2 className="font-display text-lg font-semibold">Identificar cliente</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            En la pantalla del cliente: pasa el QR del pase Onda en el sensor. Puedes pedir el
            teléfono. Lo que ocurra primero identifica la cuenta.
          </p>
          <div className="space-y-2 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              className="onda-input w-full text-center text-lg"
              disabled={identifying}
            />
            <Button
              type="button"
              className="w-full"
              isDisabled={identifying || !isCompletePhoneMask(phone)}
              onPress={() => void linkPhone()}
            >
              {identifying ? 'Identificando…' : 'Identificar con teléfono'}
            </Button>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--onda-muted)]"
            onClick={() => {
              stopIdentify();
              setView('pay');
            }}
          >
            Continuar sin identificar
          </button>
        </div>
      ) : null}

      {view === 'pay' && tab ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--onda-muted)]"
            onClick={() => setView('cart')}
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Cuenta
          </button>
          <h2 className="font-display text-lg font-semibold">
            Cobrar {formatCop(tab.total)}
          </h2>
          {tab.customerName ? (
            <p className="text-sm text-[var(--onda-muted)]">{tab.customerName}</p>
          ) : (
            <p className="text-sm text-[var(--onda-muted)]">Sin identificar</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMethodKey(m.key)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold ${
                  methodKey === m.key
                    ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                    : 'border-[var(--onda-border)]'
                }`}
              >
                {paymentIcon(m.key)}
                {m.label}
              </button>
            ))}
          </div>
          {methodKey === 'cash' ? (
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--onda-muted)]">Efectivo recibido</span>
              <input
                className="onda-input w-full text-lg font-semibold tabular-nums"
                inputMode="numeric"
                value={formatMoneyInput(cashReceived)}
                onChange={(e) => setCashReceived(parseMoneyInput(e.target.value))}
                placeholder={formatMoneyInput(String(tab.total))}
              />
              {cashReceived && Number(parseMoneyInput(cashReceived) || 0) >= tab.total ? (
                <span className="block text-sm">Cambio {formatCop(changeDue)}</span>
              ) : null}
            </label>
          ) : null}
          <Button type="button" className="w-full" isDisabled={busy} onPress={() => void cobrar()}>
            {busy ? 'Cobrando…' : `Cobrar ${formatCop(tab.total)}`}
          </Button>
          <p className="text-xs text-[var(--onda-muted)]">
            {ondaValue && tab.passId
              ? 'Al cobrar se otorgan las ondas y se envía el SMS.'
              : 'Al cobrar se imprime la factura.'}
          </p>
        </div>
      ) : null}

      {menuItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="onda-card w-full max-w-md space-y-2 p-4">
            <p className="font-semibold">{menuItem.name}</p>
            <button type="button" className="w-full rounded-full border border-[var(--onda-border)] px-4 py-2 text-sm font-semibold" onClick={() => openAdd(menuItem, false)}>
              Agregar
            </button>
            <button type="button" className="w-full rounded-full border border-[var(--onda-border)] px-4 py-2 text-sm font-semibold" onClick={() => void restarItem(menuItem)}>
              Restar
            </button>
            <button type="button" className="w-full rounded-full border border-[var(--onda-border)] px-4 py-2 text-sm font-semibold" onClick={() => openAdd(menuItem, true)}>
              Agregar con comentarios
            </button>
            <button type="button" className="w-full rounded-full border border-[var(--onda-danger)]/30 px-4 py-2 text-sm font-semibold text-[var(--onda-danger)]" onClick={() => void clearItem(menuItem)}>
              Borrar todos
            </button>
            <button type="button" className="w-full px-4 py-2 text-sm text-[var(--onda-muted)]" onClick={() => setMenuItem(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {picker ? (
        <PickerModal
          item={picker.item}
          withNote={picker.withNote}
          busy={busy}
          onCancel={() => setPicker(null)}
          onConfirm={(opts) => void addLine(picker.item, opts)}
        />
      ) : null}

      {noteItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="onda-card w-full max-w-md space-y-3 p-4">
            <p className="font-semibold">{noteItem.name}</p>
            <input
              className="onda-input w-full"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Comentario"
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onPress={() => setNoteItem(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                isDisabled={busy || !noteText.trim()}
                onPress={() => void addLine(noteItem, { note: noteText.trim() })}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
