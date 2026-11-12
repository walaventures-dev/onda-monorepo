'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { CaretRightIcon as CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { ClockIcon as Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CookingPotIcon as CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';
import { MagnifyingGlassIcon as MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { MinusIcon as Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { PlusIcon as Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { UserMinusIcon as UserMinus } from '@phosphor-icons/react/dist/csr/UserMinus';
import { CopyIcon as Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { WarningCircleIcon as WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { SwapIcon as Swap } from '@phosphor-icons/react/dist/csr/Swap';
import { ClockCountdownIcon as ClockCountdown } from '@phosphor-icons/react/dist/csr/ClockCountdown';
import { NotePencilIcon as NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { TrashIcon as Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { api, getApiAuthToken } from './api';
import { OndaBackButton } from './BackButton';
import { paymentMethodIcon } from './PosVenderCore';
import { useOndaDialogs } from './OndaDialogs';
import { PosTablesPanel } from './PosTablesPanel';
import { SkeletonList } from './Skeleton';
import { SwipeActions } from './SwipeActions';
import { useHasPosTables } from './useHasPosTables';
import { useSwipeNav } from './useSwipeNav';
import { formatCop, formatMoneyInput, parseMoneyInput } from '@onda/shared-utils';
import type {
  PosItemDto,
  PosPaymentMethodDto,
  PosTabDto,
} from '@onda/shared-types';

function elapsedMin(openedAt: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60000));
}

function elapsedTone(min: number) {
  if (min >= 20) return 'text-[var(--onda-danger)]';
  if (min >= 10) return 'text-amber-600';
  return 'text-[var(--onda-muted)]';
}

/** Tiempo de espera legible: "Recién", "12 min", "1 h 25 min", "2 d". */
function formatElapsed(min: number) {
  if (min < 1) return 'Recién';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** Beep corto con WebAudio: sin archivos ni dependencias. */
function playReadySound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.start(at);
      osc.stop(at + 0.32);
    };
    beep(ctx.currentTime, 880);
    beep(ctx.currentTime + 0.18, 1174);
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* sin audio: la notificación visual sigue */
  }
}

function itemNeedsPicker(item: PosItemDto) {
  return (item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0;
}

function lineLabel(line: PosTabDto['lines'][number]) {
  return [
    line.item?.name ?? 'Ítem',
    line.variantName,
    (line.addons || []).map((a) => a.name).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Motivos frecuentes de anulación; se pueden combinar con el texto libre. */
const VOID_REASONS: { label: string; icon: typeof UserMinus }[] = [
  { label: 'Cliente se retiró', icon: UserMinus },
  { label: 'Pedido duplicado', icon: Copy },
  { label: 'Error al cargar ítems', icon: WarningCircle },
  { label: 'Cambio de mesa', icon: Swap },
  { label: 'Demora en la preparación', icon: ClockCountdown },
  { label: 'Otro', icon: NotePencil },
];

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

/** Modal mínimo de opciones (variantes + adicionales). */
function ItemOptionsModal({
  item,
  busy,
  onCancel,
  onConfirm,
}: {
  item: PosItemDto;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (opts: { variantId?: string; addonIds: string[] }) => void;
}) {
  const variants = item.variants || [];
  const addons = item.addons || [];
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.isDefault)?.id || variants[0]?.id || '',
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const base = variants.find((v) => v.id === variantId)?.price ?? item.price;
  const extras = addons
    .filter((a) => addonIds.includes(a.id))
    .reduce((s, a) => s + a.price, 0);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="onda-card w-full max-w-md space-y-4 p-4 shadow-lg">
        <div>
          <h3 className="font-display text-lg font-semibold">{item.name}</h3>
          <p className="text-sm text-[var(--onda-muted)]">
            Elige las opciones antes de agregar.
          </p>
        </div>
        {variants.length ? (
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={`rounded-2xl border px-3 py-1.5 text-sm ${
                  variantId === v.id
                    ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)]'
                    : 'border-[var(--onda-border)]'
                }`}
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
                  aria-pressed={on}
                  onClick={() =>
                    setAddonIds((ids) =>
                      on ? ids.filter((id) => id !== a.id) : [...ids, a.id],
                    )
                  }
                  className={`rounded-2xl border px-3 py-1.5 text-sm ${
                    on
                      ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)]'
                      : 'border-[var(--onda-border)]'
                  }`}
                >
                  {a.name}
                  {a.price > 0 ? ` · ${formatCop(a.price)}` : ''}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--onda-border)] pt-3">
          <span className="font-semibold tabular-nums">
            {formatCop(base + extras)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-14"
              onPress={onCancel}
              isDisabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-14"
              isDisabled={busy || (variants.length > 0 && !variantId)}
              onPress={() =>
                onConfirm({ variantId: variantId || undefined, addonIds })
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

/**
 * Vender móvil, navegable por rutas:
 * - /vender → listado de cuentas ("Nueva cuenta" siempre visible)
 * - /vender/mesas → selector de mesas (restaurante)
 * - /vender/[tabId] → detalle de la cuenta (líneas + acciones)
 * - /vender/[tabId]/productos → grilla de productos con buscador
 *
 * La navegación la maneja el padre (Next) vía onNavigate, así todo el
 * flujo es atrás/adelante con history del navegador y enlaces profundos.
 */
export function VenderMobile({
  storeId,
  screen,
  tabId,
  onNavigate,
  onAssociateTab,
}: {
  storeId: string;
  screen: 'list' | 'mesas' | 'detail' | 'grid';
  /** Cuenta seleccionada (route param [tabId]); null en listado/mesas. */
  tabId: string | null;
  onNavigate: (path: string) => void;
  /** Swipe izquierdo sobre una cuenta: ir a asociar cliente (p. ej. /asociar/[tabId]). */
  onAssociateTab?: (tabId: string) => void;
}) {
  const hasTables = useHasPosTables(storeId);
  const [tabs, setTabs] = useState<PosTabDto[]>([]);
  const [items, setItems] = useState<PosItemDto[]>([]);
  const [methods, setMethods] = useState<PosPaymentMethodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchTabs, setSearchTabs] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [methodKey, setMethodKey] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [pickerItem, setPickerItem] = useState<PosItemDto | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<PosTabDto | null>(null);
  const [voidChoices, setVoidChoices] = useState<string[]>([]);
  const [voidText, setVoidText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [readyTabIds, setReadyTabIds] = useState<Set<string>>(new Set());
  /** Cola de comandas listas para mostrar en el modal de confirmación. */
  const [readyNotices, setReadyNotices] = useState<
    { id: string; tabLabel?: string; stationName?: string }[]
  >([]);
  /** Pide asociar cliente antes de "Pedir cuenta" si la cuenta no tiene. */
  const [askAssociate, setAskAssociate] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const skipSyncUntil = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { dialogs } = useOndaDialogs();
  /** Swipe a la derecha = atrás, siguiendo la jerarquía de rutas. */
  const goBack = useCallback(() => {
    if (screen === 'mesas') onNavigate('/vender');
    else if (screen === 'grid' && tabId) onNavigate(`/vender/${tabId}`);
    else if (screen === 'detail') onNavigate('/vender');
  }, [screen, tabId, onNavigate]);

  useSwipeNav(rootRef, { onBack: goBack, enabled: !busy });

  const tab = useMemo(
    () => tabs.find((t) => t.id === tabId) ?? null,
    [tabs, tabId],
  );

  const markLocal = useCallback(() => {
    skipSyncUntil.current = Date.now() + 800;
  }, []);

  const loadTabs = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force && Date.now() < skipSyncUntil.current) return;
      const rows = await api<PosTabDto[]>(
        `/pos/tabs?storeId=${storeId}&status=OPEN,CHECKOUT`,
      );
      setTabs(rows);
    },
    [storeId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [itemRows, methodRows] = await Promise.all([
          api<PosItemDto[]>(`/pos/stores/${storeId}/items`),
          api<PosPaymentMethodDto[]>(`/pos/stores/${storeId}/payment-methods`),
          loadTabs({ force: true }),
        ]);
        if (cancelled) return;
        setItems(itemRows.filter((i) => i.isActive));
        const active = methodRows.filter((m) => m.isActive);
        setMethods(active);
        if (active[0]) setMethodKey(active[0].key);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, loadTabs]);

  // Reloj para tiempos de espera.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // SSE: recarga cuentas y avisa (con sonido) cuando cocina marca lista una comanda.
  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: number | undefined;

    async function connect() {
      if (cancelled) return;
      source?.close();
      const token = await getApiAuthToken();
      if (cancelled) return;
      const qs = new URLSearchParams({ storeId });
      if (token) qs.set('token', token);
      source = new EventSource(`/api/pos/stream?${qs.toString()}`);
      source.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const ticket = data?.ticket;
          if (
            (data?.kind === 'kitchen_ticket_updated' ||
              data?.kind === 'kitchen_ticket_created') &&
            ticket?.id
          ) {
            if (
              ticket.status === 'READY' &&
              !notifiedRef.current.has(ticket.id)
            ) {
              notifiedRef.current.add(ticket.id);
              playReadySound();
              setReadyNotices((prev) => [
                ...prev,
                {
                  id: ticket.id,
                  tabLabel: ticket.tabLabel,
                  stationName: ticket.stationName,
                },
              ]);
              if (ticket.tabId) {
                setReadyTabIds((prev) => new Set(prev).add(ticket.tabId));
              }
            }
            if (
              (ticket.status === 'DELIVERED' || ticket.status === 'CANCELLED') &&
              ticket.tabId
            ) {
              setReadyTabIds((prev) => {
                if (!prev.has(ticket.tabId)) return prev;
                const next = new Set(prev);
                next.delete(ticket.tabId);
                return next;
              });
            }
          }
        } catch {
          /* ping u otro evento sin JSON */
        }
        void loadTabs();
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => void connect(), 4000);
      };
    }

    void connect();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      source?.close();
      source = null;
    };
  }, [storeId, loadTabs]);

  const upsert = useCallback((updated: PosTabDto) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  async function createTab(body: Record<string, unknown> = {}) {
    if (busy) return;
    markLocal();
    try {
      const created = await api<PosTabDto>(`/pos/tabs?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      upsert(created);
      setCashReceived('');
      onNavigate(`/vender/${created.id}`);
      return created;
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo crear',
      });
      return null;
    }
  }

  /** Nueva cuenta: en restaurante primero pide la mesa. */
  function startNewTab() {
    if (hasTables) onNavigate('/vender/mesas');
    else void createTab();
  }

  function openTab(id: string) {
    setCashReceived('');
    onNavigate(`/vender/${id}`);
  }

  async function setLineQty(lineId: string, quantity: number) {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/lines?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({ lineId, quantity }) },
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

  async function addItem(
    item: PosItemDto,
    opts?: { variantId?: string; addonIds?: string[] },
  ) {
    if (!tab || busy) return;
    if (!opts && itemNeedsPicker(item)) {
      setPickerItem(item);
      return;
    }
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
          }),
        },
      );
      upsert(updated);
      setPickerItem(null);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo agregar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function sendToKitchen() {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      await api(`/pos/tabs/${tab.id}/send?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadTabs({ force: true });
      toast.success('Enviado a cocina');
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo enviar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!tab || busy) return;
    setBusy(true);
    setAskAssociate(false);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/checkout?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      upsert(updated);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo pedir la cuenta',
      });
    } finally {
      setBusy(false);
    }
  }

  /** Pedir cuenta: si no hay cliente asociado, pregunta antes de continuar. */
  function requestCheckout() {
    if (!tab || busy) return;
    if (!tab.passId) {
      setAskAssociate(true);
      return;
    }
    void checkout();
  }

  async function reopen() {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tab.id}/reopen?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      upsert(updated);
      toast.success(`Cuenta ${updated.label} reabierta`);
    } catch (e) {
      // Si el estado real en servidor no era CHECKOUT (p. ej. se cobró en
      // otra sesión), converger a la verdad del servidor en vez de quedar viejo.
      await loadTabs({ force: true }).catch(() => undefined);
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo reabrir',
      });
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!tab || busy) return;
    setBusy(true);
    markLocal();
    try {
      const body: { methodKey: string; cashReceived?: number } = { methodKey };
      if (methodKey === 'cash') {
        body.cashReceived = Number(parseMoneyInput(cashReceived) || 0);
      }
      await api(`/pos/tabs/${tab.id}/pay?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Venta registrada');
      setCashReceived('');
      onNavigate('/vender');
      await loadTabs({ force: true });
      void loadItems();
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo cobrar',
      });
    } finally {
      setBusy(false);
    }
  }

  async function loadItems() {
    const rows = await api<PosItemDto[]>(`/pos/stores/${storeId}/items`);
    setItems(rows.filter((i) => i.isActive));
  }

  async function voidTab() {
    const target = voidTarget ?? tab;
    if (!target || busy) return;
    const reason =
      [...voidChoices, voidText.trim()].filter(Boolean).join(', ') || undefined;
    setBusy(true);
    markLocal();
    try {
      await api(`/pos/tabs/${target.id}/void?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast.success('Cuenta anulada');
      setVoidOpen(false);
      setVoidTarget(null);
      setVoidChoices([]);
      setVoidText('');
      if (tabId === target.id) onNavigate('/vender');
      await loadTabs({ force: true });
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo anular',
      });
    } finally {
      setBusy(false);
    }
  }

  /** Pedir cuenta desde el swipe del listado (sin entrar al detalle). */
  async function checkoutTabById(target: PosTabDto) {
    if (busy || target.status !== 'OPEN' || target.lines.length === 0) return;
    setBusy(true);
    markLocal();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${target.id}/checkout?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      upsert(updated);
      toast.success(`Cuenta ${updated.label} lista para cobrar`);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo pedir la cuenta',
      });
    } finally {
      setBusy(false);
    }
  }

  const filteredTabs = useMemo(() => {
    const q = searchTabs.trim().toLowerCase();
    const rows = q
      ? tabs.filter((t) =>
          [t.label, t.customerName, t.tableLabel]
            .filter(Boolean)
            .some((s) => (s as string).toLowerCase().includes(q)),
        )
      : tabs;
    // La que más espera primero, para priorizar atención.
    return [...rows].sort(
      (a, b) =>
        new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
    );
  }, [tabs, searchTabs]);

  const filteredItems = useMemo(() => {
    const q = searchItems.trim().toLowerCase();
    return items.filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [items, searchItems]);

  /** Unidades de cada producto ya agregadas a la cuenta (para la grilla). */
  const qtyByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of tab?.lines ?? []) {
      map.set(l.itemId, (map.get(l.itemId) ?? 0) + l.quantity);
    }
    return map;
  }, [tab?.lines]);

  const changeDue =
    tab && methodKey === 'cash'
      ? Math.max(0, Number(parseMoneyInput(cashReceived) || 0) - tab.total)
      : 0;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col gap-3">
      {/* ── Selector de mesa (restaurante) ─────────────────────────── */}
      {screen === 'mesas' && hasTables ? (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <OndaBackButton onClick={() => onNavigate('/vender')} label="Vender" />
          <PosTablesPanel
            storeId={storeId}
            mode="open"
            onOpenTab={(id) => {
              setCashReceived('');
              onNavigate(`/vender/${id}`);
            }}
            onCreateTab={(input) =>
              void createTab({
                tableId: input.tableId,
                label: input.label,
                guestCount: input.guestCount ?? null,
              })
            }
            onQuickTab={() => void createTab()}
          />
        </div>
      ) : null}

      {/* ── 1) Cuentas ─────────────────────────────────────────────── */}
      {screen === 'list' ? (
        <>
          <div className="relative">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onda-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={searchTabs}
              onChange={(e) => setSearchTabs(e.target.value)}
              placeholder="Buscar cuenta, cliente o mesa…"
              className="min-h-14 w-full rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-primary-500)]"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <SkeletonList rows={4} />
            ) : filteredTabs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Receipt
                  className="h-8 w-8 text-[var(--onda-muted)]"
                  weight="duotone"
                  aria-hidden
                />
                <p className="text-sm text-[var(--onda-muted)]">
                  {searchTabs.trim()
                    ? 'Sin resultados.'
                    : 'Sin cuentas abiertas. Crea una para empezar.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredTabs.map((t) => {
                  const min = elapsedMin(t.openedAt, now);
                  const ready = readyTabIds.has(t.id);
                  const units = t.lines.reduce((s, l) => s + l.quantity, 0);
                  return (
                    <li key={t.id}>
                      <SwipeActions
                        actions={[
                          ...(onAssociateTab
                            ? [
                                {
                                  key: 'associate',
                                  label: 'Asociar',
                                  icon: (
                                    <UserCircle
                                      className="h-5 w-5 shrink-0"
                                      weight="bold"
                                      aria-hidden
                                    />
                                  ),
                                  className:
                                    'bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]',
                                  onSelect: () => onAssociateTab(t.id),
                                },
                              ]
                            : []),
                          {
                            key: 'add',
                            label: 'Agregar ítem',
                            icon: (
                              <Plus
                                className="h-5 w-5 shrink-0"
                                weight="bold"
                                aria-hidden
                              />
                            ),
                            className:
                              'bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]',
                            onSelect: () =>
                              onNavigate(`/vender/${t.id}/productos`),
                          },
                          {
                            key: 'checkout',
                            label: 'Pedir cuenta',
                            icon: (
                              <Receipt
                                className="h-5 w-5 shrink-0"
                                weight="bold"
                                aria-hidden
                              />
                            ),
                            className: 'bg-amber-100 text-amber-800',
                            disabled: busy || t.status !== 'OPEN' || t.lines.length === 0,
                            onSelect: () => void checkoutTabById(t),
                          },
                          {
                            key: 'void',
                            label: 'Anular',
                            icon: (
                              <Trash
                                className="h-5 w-5 shrink-0"
                                weight="bold"
                                aria-hidden
                              />
                            ),
                            className:
                              'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]',
                            disabled: busy,
                            onSelect: () => {
                              setVoidChoices([]);
                              setVoidText('');
                              setVoidTarget(t);
                              setVoidOpen(true);
                            },
                          },
                        ]}
                      >
                        <button
                          type="button"
                          onClick={() => openTab(t.id)}
                          className={`onda-card flex min-h-24 w-full items-center gap-4 p-4 text-left transition active:scale-[0.99] sm:p-5 ${
                            ready ? 'ring-2 ring-[var(--onda-success)]/50' : ''
                          }`}
                        >
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]">
                            <Receipt className="h-7 w-7" weight="duotone" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-lg font-semibold text-[var(--onda-ink)]">
                              {t.label}
                              {t.customerName ? ` · ${t.customerName}` : ''}
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span
                                className={`inline-flex items-center gap-1 text-sm tabular-nums ${elapsedTone(min)}`}
                              >
                                <Clock className="h-3.5 w-3.5" weight="regular" aria-hidden />
                                {formatElapsed(min)}
                              </span>
                              {t.status === 'CHECKOUT' ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                                  Por cobrar
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--onda-primary-700)]">
                                  Abierta
                                </span>
                              )}
                              <span className="text-sm text-[var(--onda-muted)]">
                                {units} ítem{units === 1 ? '' : 's'}
                              </span>
                              {ready ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--onda-success)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--onda-success)]">
                                  <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                                  Lista en cocina
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="shrink-0 font-display text-2xl font-bold tabular-nums text-[var(--onda-ink)]">
                            {formatCop(t.total)}
                          </span>
                        </button>
                      </SwipeActions>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Fijo y pegado a la bottom bar (h-14 + safe-area); no depende de la
              altura del contenedor (h-full falla en algunos navegadores móviles). */}
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 bg-[var(--onda-bg)]">
            <div className="mx-auto w-full max-w-6xl px-4 pt-2">
              <Button onPress={startNewTab} isDisabled={busy} fullWidth className="min-h-14 text-base">
                <Plus className="h-4 w-4" weight="bold" aria-hidden /> Nueva cuenta
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {/* ── 2) Detalle de la cuenta ────────────────────────────────── */}
      {screen === 'detail' && tab ? (
        <>
          <div className="flex items-center gap-2">
            <OndaBackButton onClick={() => onNavigate('/vender')} label="Cuentas" />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--onda-muted)]">
              {tab.label}
              {tab.tableLabel ? ` · Mesa ${tab.tableLabel}` : ''}
              {' · '}
              {tab.status === 'CHECKOUT' ? 'Por cobrar' : 'Abierta'}
            </span>
            <span className="shrink-0 font-display text-xl font-bold tabular-nums">
              {formatCop(tab.total)}
            </span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => onNavigate(`/asociar/${tab.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--onda-ink)]/10 bg-[var(--onda-card)] px-4 py-2.5 text-left transition active:scale-[0.98] disabled:opacity-50"
          >
            <UserCircle
              className={`h-5 w-5 shrink-0 ${
                tab.passId
                  ? 'text-[var(--onda-success)]'
                  : 'text-[var(--onda-primary-500)]'
              }`}
              weight="regular"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {tab.customerName || 'Asociar cliente'}
            </span>
            {tab.passId ? (
              <Check
                className="h-4 w-4 shrink-0 text-[var(--onda-success)]"
                weight="bold"
                aria-hidden
              />
            ) : (
              <CaretRight
                className="h-4 w-4 shrink-0 text-[var(--onda-muted)]"
                weight="regular"
                aria-hidden
              />
            )}
          </button>

          {/* pb: deja despejado el hueco del botón fijo inferior. */}
          <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pb-16">
            {tab.lines.length === 0 ? (
              <li className="py-8 text-center text-base text-[var(--onda-muted)]">
                Cuenta vacía. Agrega productos desde la grilla.
              </li>
            ) : (
              tab.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--onda-ink)]/10 bg-[var(--onda-card)] px-3 py-3"
                >
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--onda-border)]">
                    {line.item ? (
                      <ItemPhoto item={line.item} />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[var(--onda-bg)] font-display text-lg font-semibold text-[var(--onda-muted)]">
                        {lineLabel(line).trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`truncate text-base font-semibold ${
                          line.sentAt ? 'text-[var(--onda-muted)]' : ''
                        }`}
                      >
                        {lineLabel(line)}
                      </p>
                      {line.sentAt ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--onda-sky-soft)] px-2 py-0.5 text-[11px] font-semibold">
                          <CookingPot className="h-3.5 w-3.5" weight="regular" aria-hidden />
                          Cocina
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-[var(--onda-ink)]/70">
                      {formatCop(line.unitPrice)} c/u
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {tab.status === 'OPEN' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Quitar uno"
                          disabled={busy}
                          onClick={() => void setLineQty(line.id, Math.max(0, line.quantity - 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--onda-ink)]/20 bg-white text-[var(--onda-ink)] transition hover:bg-[var(--onda-bg)] active:scale-95 disabled:opacity-50"
                        >
                          <Minus className="h-5 w-5" weight="regular" aria-hidden />
                        </button>
                        <span className="w-7 text-center text-base font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Agregar uno"
                          disabled={busy}
                          onClick={() => void setLineQty(line.id, line.quantity + 1)}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--onda-primary-500)] text-white transition hover:bg-[var(--onda-primary-600)] active:scale-95 disabled:opacity-50"
                        >
                          <Plus className="h-5 w-5" weight="regular" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="text-base font-bold tabular-nums">
                        ×{line.quantity}
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums text-[var(--onda-ink)]">
                      {formatCop(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="flex flex-col gap-2 border-t border-[var(--onda-border)] pt-3">
            {tab.status === 'OPEN' ? (
              <>
                <div className="flex gap-2">
                  <Button
                    fullWidth
                    className="min-h-14 flex-[2] text-lg font-bold"
                    isDisabled={busy || tab.lines.length === 0}
                    onPress={requestCheckout}
                  >
                    <Receipt
                      className="h-6 w-6"
                      weight="duotone"
                      aria-hidden
                    />
                    Pedir cuenta
                    <span className="tabular-nums opacity-80">
                      {formatCop(tab.total)}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    aria-label="Agregar productos"
                    className="min-h-14 w-1/3 shrink-0 border-transparent bg-[var(--onda-primary-100)] text-[var(--onda-primary-600)]"
                    isDisabled={busy}
                    onPress={() => onNavigate(`/vender/${tab.id}/productos`)}
                  >
                    <Plus className="h-6 w-6" weight="bold" aria-hidden />
                  </Button>
                </div>
                {tab.lines.some((l) => !l.sentAt) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendToKitchen()}
                    className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--onda-sky)] px-3 text-lg font-bold text-[var(--onda-ink)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CookingPot className="h-6 w-6" weight="regular" aria-hidden />
                    Enviar a cocina ({tab.lines.filter((l) => !l.sentAt).length})
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setVoidChoices([]);
                    setVoidText('');
                    setVoidTarget(tab);
                    setVoidOpen(true);
                  }}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--onda-danger)]/40 px-3 text-sm font-semibold text-[var(--onda-danger)] transition hover:bg-[var(--onda-danger)]/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anular cuenta
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      disabled={busy}
                      onClick={() => setMethodKey(m.key)}
                      aria-pressed={methodKey === m.key}
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-semibold transition ${
                        methodKey === m.key
                          ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                          : 'border-[var(--onda-border)] text-[var(--onda-muted)]'
                      }`}
                    >
                      {paymentMethodIcon(m.key)}
                      {m.label}
                    </button>
                  ))}
                </div>
                {methodKey === 'cash' ? (
                  <label className="block space-y-1 text-sm">
                    <span className="text-xs text-[var(--onda-muted)]">
                      Efectivo recibido
                    </span>
                    <input
                      className="onda-input w-full tabular-nums text-base font-semibold"
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(cashReceived)}
                      onChange={(e) => setCashReceived(parseMoneyInput(e.target.value))}
                      placeholder={formatMoneyInput(String(tab.total))}
                    />
                    {cashReceived ? (
                      Number(parseMoneyInput(cashReceived) || 0) >= tab.total ? (
                        <span className="block text-sm font-semibold text-[var(--onda-success)]">
                          Cambio: {formatCop(changeDue)}
                        </span>
                      ) : (
                        <span className="block text-sm text-amber-600">
                          Faltan{' '}
                          {formatCop(
                            tab.total - Number(parseMoneyInput(cashReceived) || 0),
                          )}
                        </span>
                      )
                    ) : null}
                  </label>
                ) : null}
                <Button
                  fullWidth
                  className="min-h-14 text-base"
                  isDisabled={busy}
                  onPress={() => void pay()}
                >
                  {busy ? 'Cobrando…' : `Cobrar ${formatCop(tab.total)}`}
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reopen()}
                  className="min-h-14 text-xs font-medium text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)] disabled:opacity-50"
                >
                  Volver a editar
                </button>
              </>
            )}
          </div>
        </>
      ) : null}

      {/* ── 3) Grilla de productos ─────────────────────────────────── */}
      {screen === 'grid' && tab ? (
        <>
          <div className="flex items-center gap-2">
            <OndaBackButton
              onClick={() => onNavigate(`/vender/${tab.id}`)}
              label="Cuenta"
            />
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onda-muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={searchItems}
                onChange={(e) => setSearchItems(e.target.value)}
                placeholder="Buscar producto…"
                className="min-h-14 w-full rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-primary-500)]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--onda-muted)]">
                {searchItems.trim()
                  ? 'Ningún producto coincide.'
                  : 'No hay productos activos.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredItems.map((item) => {
                  const inTab = qtyByItemId.get(item.id) ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void addItem(item)}
                      className="onda-card relative overflow-hidden p-0 text-left transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <ItemPhoto item={item} />
                      {inTab > 0 ? (
                        <span
                          aria-label={`${inTab} en la cuenta`}
                          className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-1.5 text-sm font-bold text-white shadow-lg"
                        >
                          {inTab}
                        </span>
                      ) : null}
                      <span className="block space-y-0.5 p-3">
                        <span className="line-clamp-2 block text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="flex items-center justify-between text-sm tabular-nums text-[var(--onda-primary-500)]">
                          {formatCop(item.price)}
                          <CaretRight className="h-3.5 w-3.5" weight="regular" aria-hidden />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate(`/vender/${tab.id}`)}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--onda-ink)] px-4 text-base font-semibold text-white transition active:scale-[0.99]"
          >
            Ver cuenta
            <span className="tabular-nums text-[var(--onda-lime)]">
              {formatCop(tab.total)}
            </span>
            <span className="text-sm font-medium text-white/70">
              · {tab.lines.reduce((s, l) => s + l.quantity, 0)} ítem
              {tab.lines.reduce((s, l) => s + l.quantity, 0) === 1 ? '' : 's'}
            </span>
          </button>
        </>
      ) : null}

      {voidOpen && voidTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="onda-card w-full max-w-md space-y-4 p-4 shadow-lg">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Anular cuenta
              </h3>
              <p className="text-sm text-[var(--onda-muted)]">
                Se anulará la cuenta &quot;{voidTarget.label}&quot; y se
                descartarán sus líneas. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VOID_REASONS.map(({ label, icon: Icon }) => {
                const on = voidChoices.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={busy}
                    aria-pressed={on}
                    onClick={() =>
                      setVoidChoices((prev) =>
                        on ? prev.filter((x) => x !== label) : [...prev, label],
                      )
                    }
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-center text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${
                      on
                        ? 'border-[var(--onda-danger)] bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]'
                        : 'border-[var(--onda-border)] text-[var(--onda-muted)]'
                    }`}
                  >
                    <Icon className="h-6 w-6" weight="regular" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={voidText}
              onChange={(e) => setVoidText(e.target.value)}
              rows={2}
              placeholder="Otro motivo (opcional)…"
              disabled={busy}
              className="onda-input w-full resize-none text-sm"
            />
            <div className="flex gap-2 border-t border-[var(--onda-border)] pt-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-14 flex-1"
                isDisabled={busy}
                onPress={() => setVoidOpen(false)}
              >
                Cancelar
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void voidTab()}
                className="flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[var(--onda-danger)] px-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Anulando…' : 'Anular cuenta'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pickerItem ? (
        <ItemOptionsModal
          item={pickerItem}
          busy={busy}
          onCancel={() => setPickerItem(null)}
          onConfirm={(opts) => void addItem(pickerItem, opts)}
        />
      ) : null}

      {/* ── Modal: ¿asociar cliente antes de pedir cuenta? ─────────── */}
      {askAssociate && tab ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Asociar cliente"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[var(--onda-card)] p-6 text-center shadow-xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)]">
              <UserCircle className="h-8 w-8" weight="regular" aria-hidden />
            </span>
            <p className="mt-4 font-display text-xl font-bold text-[var(--onda-ink)]">
              ¿Asociar cliente?
            </p>
            <p className="mt-1 text-sm text-[var(--onda-muted)]">
              &quot;{tab.label}&quot; no tiene cliente asociado. Si lo
              asocias, acumula ondas al cobrar.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                fullWidth
                className="min-h-12 text-base font-semibold"
                onPress={() => {
                  setAskAssociate(false);
                  onNavigate(`/asociar/${tab.id}`);
                }}
              >
                Asociar cliente
              </Button>
              <Button
                fullWidth
                variant="outline"
                className="min-h-12 text-base"
                isDisabled={busy}
                onPress={() => void checkout()}
              >
                Continuar sin asociar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Aviso modal: comanda lista en cocina ───────────────────── */}
      {readyNotices[0] ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Comanda lista"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[var(--onda-card)] p-6 text-center shadow-xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--onda-success)]/15 text-[var(--onda-success)]">
              <Check className="h-8 w-8" weight="bold" aria-hidden />
            </span>
            <p className="mt-4 font-display text-xl font-bold text-[var(--onda-ink)]">
              Comanda lista
            </p>
            <p className="mt-1 text-sm text-[var(--onda-muted)]">
              {readyNotices[0].tabLabel
                ? `${readyNotices[0].tabLabel}${
                    readyNotices[0].stationName
                      ? ` · ${readyNotices[0].stationName}`
                      : ''
                  } lista para entregar`
                : 'Productos listos en cocina'}
            </p>
            {readyNotices.length > 1 ? (
              <p className="mt-1 text-xs text-[var(--onda-muted)]">
                {readyNotices.length - 1}{' '}
                {readyNotices.length - 1 === 1 ? 'pendiente más' : 'pendientes más'}
              </p>
            ) : null}
            <Button
              fullWidth
              className="mt-5 min-h-12 text-base font-semibold"
              onPress={() => setReadyNotices((prev) => prev.slice(1))}
            >
              Aceptar
            </Button>
          </div>
        </div>
      ) : null}

      {dialogs}
    </div>
  );
}
