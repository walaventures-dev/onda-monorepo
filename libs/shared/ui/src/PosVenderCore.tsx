'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { OndaIcons } from './icons';
import { PhoneInput } from './PhoneInput';
import { SkeletonCards } from './Skeleton';
import { api } from './api';
import {
  formatCop,
  formatMoneyInput,
  isCompletePhoneMask,
  ondasFromPayment,
  parseMoneyInput,
  toE164Colombia,
} from '@onda/shared-utils';
import type {
  PosAttendantDto,
  PosItemDto,
  PosPaymentMethodDto,
  PosTabDto,
} from '@onda/shared-types';
import { MoneyIcon as Money } from '@phosphor-icons/react/dist/csr/Money';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { BankIcon as Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { MinusIcon as Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { PlusIcon as Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { PhoneIcon as Phone } from '@phosphor-icons/react/dist/csr/Phone';
import type { ReactNode } from 'react';

export type PosVenderMemberSession = {
  memberId: string;
  name: string;
  role?: 'ADMIN' | 'CAJA';
};

export type AttendFilter = 'all' | 'me' | 'unassigned' | string;

function patchTabLineQty(tab: PosTabDto, lineId: string, quantity: number): PosTabDto {
  const lines =
    quantity <= 0
      ? tab.lines.filter((l) => l.id !== lineId)
      : tab.lines.map((l) => (l.id === lineId ? { ...l, quantity } : l));
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return { ...tab, lines, subtotal: total, total };
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

function tabStatusLabel(status: PosTabDto['status']) {
  if (status === 'OPEN') return 'Abierta';
  if (status === 'CHECKOUT') return 'Por cobrar';
  return status;
}

function paymentMethodIcon(key: string): ReactNode {
  const cls = 'h-5 w-5';
  if (key === 'cash') return <Money className={cls} weight="regular" aria-hidden />;
  if (key === 'card') return <CreditCard className={cls} weight="regular" aria-hidden />;
  if (key === 'transfer') return <Bank className={cls} weight="regular" aria-hidden />;
  return <Money className={cls} weight="regular" aria-hidden />;
}

function itemNeedsPicker(item: PosItemDto) {
  return (item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0;
}

function lineLabel(line: PosTabDto['lines'][number]) {
  const parts = [
    line.item?.name ?? 'Ítem',
    line.variantName,
    (line.addons || []).map((a) => a.name).join(', '),
  ].filter(Boolean);
  return parts.join(' · ');
}

function ItemPickerModal({
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
  const defaultVariant =
    variants.find((v) => v.isDefault)?.id || variants[0]?.id || '';
  const [variantId, setVariantId] = useState(defaultVariant);
  const [addonIds, setAddonIds] = useState<string[]>([]);

  const base =
    variants.find((v) => v.id === variantId)?.price ?? item.price;
  const extras = addons
    .filter((a) => addonIds.includes(a.id))
    .reduce((s, a) => s + a.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="onda-card w-full max-w-md space-y-4 p-4 shadow-lg">
        <div>
          <h3 className="font-display text-lg font-semibold">{item.name}</h3>
          <p className="text-sm text-[var(--onda-muted)]">
            Elige opciones antes de agregar a la cuenta.
          </p>
        </div>

        {variants.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              Variante
            </p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    variantId === v.id
                      ? 'border-[var(--onda-primary)] bg-[var(--onda-primary-100)]'
                      : 'border-[var(--onda-border)]'
                  }`}
                  onClick={() => setVariantId(v.id)}
                >
                  {v.name} · {formatCop(v.price)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {addons.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              Adicionales (opcionales)
            </p>
            <div className="flex flex-wrap gap-2">
              {addons.map((a) => {
                const on = addonIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      on
                        ? 'border-[var(--onda-primary)] bg-[var(--onda-primary-100)]'
                        : 'border-[var(--onda-border)]'
                    }`}
                    onClick={() =>
                      setAddonIds((ids) =>
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
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--onda-border)] pt-3">
          <span className="text-sm font-semibold tabular-nums">
            {formatCop(base + extras)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onPress={onCancel} isDisabled={busy}>
              {OndaIcons.close} Cancelar
            </Button>
            <Button
              type="button"
              isDisabled={busy || (variants.length > 0 && !variantId)}
              onPress={() =>
                onConfirm({
                  variantId: variantId || undefined,
                  addonIds,
                })
              }
            >
              {OndaIcons.plus} Agregar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PosVenderCore({
  storeId,
  ondaValue,
  variant = 'dashboard',
  memberSession = null,
  headerExtra,
  onLeave,
}: {
  storeId: string;
  ondaValue?: number | null;
  /** dashboard = merchant layout; kiosk = PWA caja denser layout */
  variant?: 'dashboard' | 'kiosk';
  memberSession?: PosVenderMemberSession | null;
  headerExtra?: ReactNode;
  onLeave?: () => void;
}) {
  const [items, setItems] = useState<PosItemDto[]>([]);
  const [tabs, setTabs] = useState<PosTabDto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PosPaymentMethodDto[]>(
    [],
  );
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lineBusyId, setLineBusyId] = useState<string | null>(null);
  const [methodKey, setMethodKey] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [pickerItem, setPickerItem] = useState<PosItemDto | null>(null);
  const [linkPhone, setLinkPhone] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkingCustomer, setLinkingCustomer] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [attendFilter, setAttendFilter] = useState<AttendFilter>('all');
  const [attendants, setAttendants] = useState<PosAttendantDto[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const skipRemoteSyncUntil = useRef(0);

  const selectedTab = useMemo(
    () => tabs.find((t) => t.id === selectedTabId) ?? null,
    [tabs, selectedTabId],
  );

  const previewOndas = useMemo(() => {
    if (!selectedTab?.passId) return null;
    const value =
      ondaValue != null && Number(ondaValue) > 0 ? Number(ondaValue) : null;
    if (value == null) return null;
    return ondasFromPayment(selectedTab.total, value);
  }, [selectedTab, ondaValue]);

  const activeItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.isActive &&
          i.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [items, search],
  );

  const upsertTab = useCallback((tab: PosTabDto) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tab.id);
      if (idx === -1) return [tab, ...prev];
      const next = [...prev];
      next[idx] = tab;
      return next;
    });
  }, []);

  const markLocalMutation = useCallback(() => {
    skipRemoteSyncUntil.current = Date.now() + 800;
  }, []);

  const loadItems = useCallback(async () => {
    const rows = await api<PosItemDto[]>(`/pos/stores/${storeId}/items`);
    setItems(rows.filter((i) => i.isActive));
  }, [storeId]);

  const loadTabs = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force && Date.now() < skipRemoteSyncUntil.current) return;
      const qs = new URLSearchParams({
        storeId,
        status: 'OPEN,CHECKOUT',
      });
      if (attendFilter !== 'all') qs.set('attendedBy', attendFilter);
      const rows = await api<PosTabDto[]>(`/pos/tabs?${qs.toString()}`);
      setTabs(rows);
      setSelectedTabId((cur) => {
        if (cur && rows.some((t) => t.id === cur)) return cur;
        return rows[0]?.id ?? null;
      });
    },
    [storeId, attendFilter],
  );

  const loadPaymentMethods = useCallback(async () => {
    const rows = await api<PosPaymentMethodDto[]>(
      `/pos/stores/${storeId}/payment-methods`,
    );
    setPaymentMethods(rows.filter((m) => m.isActive));
    if (rows.length) setMethodKey(rows.find((m) => m.isActive)?.key ?? 'cash');
  }, [storeId]);

  const loadAttendants = useCallback(async () => {
    try {
      const rows = await api<PosAttendantDto[]>(
        `/pos/stores/${storeId}/attendants`,
      );
      setAttendants(rows);
    } catch {
      setAttendants([]);
    }
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadItems(),
          loadTabs({ force: true }),
          loadPaymentMethods(),
          loadAttendants(),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadItems, loadTabs, loadPaymentMethods, loadAttendants]);

  useEffect(() => {
    const es = new EventSource(`/api/pos/stream?storeId=${storeId}`);
    es.onmessage = () => void loadTabs();
    return () => es.close();
  }, [storeId, loadTabs]);

  async function createNewTab() {
    markLocalMutation();
    const tab = await api<PosTabDto>(`/pos/tabs?storeId=${storeId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    upsertTab(tab);
    setSelectedTabId(tab.id);
    return tab;
  }

  async function addProduct(
    item: PosItemDto,
    opts?: { variantId?: string; addonIds?: string[] },
  ) {
    if (busy || lineBusyId) return;
    if (!opts && itemNeedsPicker(item)) {
      setPickerItem(item);
      return;
    }
    setBusy(true);
    try {
      let tab = selectedTab;
      if (!tab || tab.status !== 'OPEN') {
        tab = await createNewTab();
      }
      markLocalMutation();
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
      upsertTab(updated);
      setPickerItem(null);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo agregar el ítem',
      });
    } finally {
      setBusy(false);
    }
  }

  async function setLineQty(lineId: string, quantity: number) {
    if (!selectedTab || selectedTab.status !== 'OPEN' || lineBusyId) return;
    const previous = selectedTab;
    // Optimistic: solo actualiza la cuenta, sin bloquear la grilla
    upsertTab(patchTabLineQty(selectedTab, lineId, quantity));
    setLineBusyId(lineId);
    markLocalMutation();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${selectedTab.id}/lines?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({ lineId, quantity }),
        },
      );
      upsertTab(updated);
    } catch (e) {
      upsertTab(previous);
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo actualizar',
      });
    } finally {
      setLineBusyId(null);
    }
  }

  async function checkout() {
    if (!selectedTab || busy) return;
    setBusy(true);
    markLocalMutation();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${selectedTab.id}/checkout?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      upsertTab(updated);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo pedir la cuenta',
      });
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!selectedTab || busy) return;
    setBusy(true);
    markLocalMutation();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${selectedTab.id}/reopen?storeId=${storeId}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      upsertTab(updated);
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo reabrir',
      });
    } finally {
      setBusy(false);
    }
  }

  async function voidTab() {
    if (!selectedTab || busy) return;
    setBusy(true);
    markLocalMutation();
    try {
      await api(`/pos/tabs/${selectedTab.id}/void?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTabs((prev) => prev.filter((t) => t.id !== selectedTab.id));
      setSelectedTabId(null);
      toast.success('Cuenta anulada');
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo anular',
      });
    } finally {
      setBusy(false);
    }
  }

  async function assignAttendant(memberId: string | null) {
    if (!selectedTab || assignBusy) return;
    setAssignBusy(true);
    markLocalMutation();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${selectedTab.id}/assign?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({ memberId }),
        },
      );
      upsertTab(updated);
      toast.success(
        memberId ? 'Atendente asignado' : 'Cuenta sin atendente',
      );
    } catch (e) {
      toast.danger('Error', {
        description:
          e instanceof Error ? e.message : 'No se pudo asignar',
      });
    } finally {
      setAssignBusy(false);
    }
  }

  const isKiosk = variant === 'kiosk';
  const canAssign =
    Boolean(memberSession) &&
    (memberSession?.role === 'ADMIN' || Boolean(memberSession?.memberId));
  const filterChips: Array<{ id: AttendFilter; label: string }> = [
    { id: 'all', label: 'Todas' },
    ...(memberSession
      ? [{ id: 'me' as AttendFilter, label: 'Mías' }]
      : []),
    { id: 'unassigned', label: 'Sin asignar' },
  ];

  async function linkCustomer() {
    if (!selectedTab || linkingCustomer || busy) return;
    if (!isCompletePhoneMask(linkPhone)) {
      toast.danger('Teléfono incompleto', {
        description: 'Ingresa un celular de 10 dígitos.',
      });
      return;
    }
    setLinkingCustomer(true);
    markLocalMutation();
    try {
      const updated = await api<PosTabDto>(
        `/pos/tabs/${selectedTab.id}/link-phone?storeId=${storeId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: toE164Colombia(linkPhone),
            guestName: linkName.trim() || undefined,
          }),
        },
      );
      upsertTab(updated);
      setLinkPhone('');
      setLinkName('');
      setShowLinkForm(false);
      toast.success('Cliente asociado', {
        description: updated.customerName
          ? `${updated.customerName} quedará con ondas al cobrar.`
          : 'Al cobrar se otorgan ondas automáticamente.',
      });
    } catch (e) {
      toast.danger('Error', {
        description:
          e instanceof Error ? e.message : 'No se pudo asociar el cliente',
      });
    } finally {
      setLinkingCustomer(false);
    }
  }

  useEffect(() => {
    setLinkPhone('');
    setLinkName('');
    setShowLinkForm(false);
  }, [selectedTabId]);

  async function pay() {
    if (!selectedTab || selectedTab.status !== 'CHECKOUT' || busy) return;
    setBusy(true);
    markLocalMutation();
    try {
      const body: { methodKey: string; cashReceived?: number } = { methodKey };
      if (methodKey === 'cash') {
        body.cashReceived = Number(parseMoneyInput(cashReceived) || 0);
      }
      await api(`/pos/tabs/${selectedTab.id}/pay?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Venta registrada');
      setTabs((prev) => prev.filter((t) => t.id !== selectedTab.id));
      setSelectedTabId(null);
      setCashReceived('');
      void loadItems();
    } catch (e) {
      toast.danger('Error', {
        description: e instanceof Error ? e.message : 'No se pudo cobrar',
      });
    } finally {
      setBusy(false);
    }
  }

  const changeDue =
    selectedTab && methodKey === 'cash'
      ? Math.max(
          0,
          Number(parseMoneyInput(cashReceived) || 0) - selectedTab.total,
        )
      : 0;

  return (
    <div
      className={`flex flex-col gap-4 ${
        isKiosk
          ? 'min-h-[70dvh]'
          : 'min-h-[calc(100vh-12rem)] lg:min-h-[32rem]'
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isKiosk ? (
            <>
              <h2 className="font-display text-xl font-semibold">Vender</h2>
              <p className="text-sm text-[var(--onda-muted)]">
                Elige productos, arma la cuenta y cobra.
              </p>
            </>
          ) : (
            <div className="space-y-1">
              {headerExtra}
              {memberSession ? (
                <p className="text-xs text-[var(--onda-muted)]">
                  Atendiendo:{' '}
                  <span className="font-semibold text-[var(--onda-ink)]">
                    {memberSession.name}
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar producto…"
            className="onda-input min-w-[12rem] flex-1 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => void createNewTab()}
            isDisabled={busy}
          >
            {OndaIcons.plus} Nueva cuenta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setAttendFilter(chip.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              attendFilter === chip.id
                ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                : 'bg-[var(--onda-bg)] text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
        {attendants.length > 1 ? (
          <select
            className="onda-input max-w-[10rem] rounded-full py-1 text-xs"
            value={
              attendFilter !== 'all' &&
              attendFilter !== 'me' &&
              attendFilter !== 'unassigned'
                ? attendFilter
                : ''
            }
            onChange={(e) =>
              setAttendFilter(e.target.value ? e.target.value : 'all')
            }
            aria-label="Filtrar por atendente"
          >
            <option value="">De alguien…</option>
            {attendants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,13rem)_1fr_minmax(0,18rem)]">
        <aside className="onda-card flex flex-col overflow-hidden p-0">
          <div className="border-b border-[var(--onda-border)] px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              En curso
            </h3>
          </div>
          <ul className="max-h-64 flex-1 overflow-y-auto lg:max-h-none">
            {tabs.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--onda-muted)]">
                Sin cuentas abiertas
              </li>
            ) : (
              tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    className={`w-full border-b border-[var(--onda-border)] px-3 py-3 text-left transition ${
                      tab.id === selectedTabId
                        ? 'bg-[var(--onda-sky-soft)]'
                        : 'hover:bg-[var(--onda-bg)]'
                    }`}
                    onClick={() => setSelectedTabId(tab.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--onda-ink)]">
                        {tab.label}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-[var(--onda-ink)]">
                        {formatCop(tab.total)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--onda-muted)]">
                      {tabStatusLabel(tab.status)}
                      {tab.customerName
                        ? ` · ${tab.customerName}`
                        : tab.lines.length
                          ? ` · ${tab.lines.length} ítem${tab.lines.length === 1 ? '' : 's'}`
                          : ''}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--onda-primary-700)]">
                      {tab.attendedByName
                        ? tab.attendedByName
                        : 'Sin asignar'}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="min-h-[16rem]">
          {loading ? (
            <SkeletonCards count={8} />
          ) : activeItems.length === 0 ? (
            <div className="onda-card flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm text-[var(--onda-muted)]">
                {search.trim()
                  ? 'Ningún producto coincide con la búsqueda.'
                  : 'No hay productos activos. Agrégalos en Inventario.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {activeItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className="onda-card group relative cursor-pointer overflow-hidden p-0 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[var(--onda-primary-500)]/45 hover:shadow-[0_12px_28px_rgba(26,27,46,0.1)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  onClick={() => void addProduct(item)}
                >
                  <div className="relative overflow-hidden">
                    <div className="transition duration-150 group-hover:scale-[1.03] group-active:scale-100">
                      <ItemPhoto item={item} />
                    </div>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--onda-ink)]/45 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--onda-ink)] shadow-sm">
                        {OndaIcons.plus}
                        {(item.variants?.length || item.addons?.length)
                          ? 'Elegir'
                          : 'Agregar'}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--onda-ink)]">
                      {item.name}
                    </p>
                    <p className="text-sm tabular-nums text-[var(--onda-primary-500)]">
                      {formatCop(item.price)}
                    </p>
                    {item.trackStock && item.stockQty != null && item.stockQty <= 5 ? (
                      <p className="text-xs text-amber-600">
                        Stock: {item.stockQty}
                      </p>
                    ) : null}
                    {(item.variants?.length || item.addons?.length) ? (
                      <p className="text-[11px] text-[var(--onda-muted)]">
                        Toca para elegir opciones
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="onda-card flex flex-col overflow-hidden">
          {!selectedTab ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-[var(--onda-muted)]">
                Selecciona una cuenta o toca un producto para empezar.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--onda-border)] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[var(--onda-ink)]">
                      {selectedTab.label}
                    </h3>
                    <p className="text-xs text-[var(--onda-muted)]">
                      {tabStatusLabel(selectedTab.status)}
                    </p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatCop(selectedTab.total)}
                  </span>
                </div>

                {canAssign && attendants.length > 0 ? (
                  <label className="mt-3 block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                      Atiende
                    </span>
                    <select
                      className="onda-input w-full text-sm"
                      disabled={assignBusy || busy}
                      value={selectedTab.attendedByMemberId || ''}
                      onChange={(e) =>
                        void assignAttendant(e.target.value || null)
                      }
                    >
                      <option value="">Sin asignar</option>
                      {attendants.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : selectedTab.attendedByName ? (
                  <p className="mt-2 text-xs text-[var(--onda-muted)]">
                    Atiende:{' '}
                    <span className="font-medium text-[var(--onda-ink)]">
                      {selectedTab.attendedByName}
                    </span>
                  </p>
                ) : null}

                {selectedTab.passId ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--onda-success)]/10 px-3 py-2">
                    <UserCircle
                      className="h-5 w-5 shrink-0 text-[var(--onda-success)]"
                      weight="duotone"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                        {selectedTab.customerName || 'Cliente vinculado'}
                      </p>
                      <p className="text-[11px] text-[var(--onda-muted)]">
                        {previewOndas == null
                          ? 'Ondas al cobrar esta venta'
                          : previewOndas > 0
                            ? `+${previewOndas} onda${previewOndas === 1 ? '' : 's'} al cobrar`
                            : '+0 ondas al cobrar (venta registrada)'}
                      </p>
                    </div>
                  </div>
                ) : selectedTab.status === 'OPEN' ||
                  selectedTab.status === 'CHECKOUT' ? (
                  <div className="mt-3 space-y-2">
                    {!showLinkForm ? (
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--onda-border)] px-3 py-2 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-primary)]/40 hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-primary)]"
                        onClick={() => setShowLinkForm(true)}
                        disabled={busy || linkingCustomer}
                      >
                        <Phone className="h-3.5 w-3.5" weight="regular" aria-hidden />
                        Asociar cliente por teléfono
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)]/50 p-3">
                        <p className="text-xs font-semibold text-[var(--onda-ink)]">
                          Asociar cliente
                        </p>
                        <label className="block space-y-1 text-sm">
                          <span className="text-xs text-[var(--onda-muted)]">
                            Celular
                          </span>
                          <PhoneInput
                            value={linkPhone}
                            onChange={setLinkPhone}
                            className="onda-input w-full"
                            disabled={linkingCustomer}
                          />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span className="text-xs text-[var(--onda-muted)]">
                            Nombre (si es nuevo)
                          </span>
                          <input
                            className="onda-input w-full"
                            value={linkName}
                            onChange={(e) => setLinkName(e.target.value)}
                            placeholder="Opcional"
                            disabled={linkingCustomer}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="flex-1"
                            size="sm"
                            isDisabled={
                              linkingCustomer || !isCompletePhoneMask(linkPhone)
                            }
                            onClick={() => void linkCustomer()}
                          >
                            {linkingCustomer
                              ? 'Asociando…'
                              : (
                                  <>
                                    {OndaIcons.check} Asociar
                                  </>
                                )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            isDisabled={linkingCustomer}
                            onClick={() => {
                              setShowLinkForm(false);
                              setLinkPhone('');
                              setLinkName('');
                            }}
                          >
                            {OndaIcons.close} Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                {selectedTab.lines.length === 0 ? (
                  <li className="py-8 text-center text-sm text-[var(--onda-muted)]">
                    Agrega productos desde la grilla.
                  </li>
                ) : (
                  selectedTab.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-center gap-2 rounded-xl border border-[var(--onda-border)] px-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {lineLabel(line)}
                        </p>
                        <p className="text-xs tabular-nums text-[var(--onda-muted)]">
                          {formatCop(line.unitPrice)}
                          {(line.addons || []).some((a) => a.price > 0)
                            ? ' c/u'
                            : ''}
                        </p>
                      </div>
                      {selectedTab.status === 'OPEN' ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--onda-border)] text-sm transition hover:border-[var(--onda-primary)]/40 hover:bg-[var(--onda-bg)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() =>
                              void setLineQty(
                                line.id,
                                Math.max(0, line.quantity - 1),
                              )
                            }
                            disabled={lineBusyId === line.id}
                            aria-label="Quitar uno"
                          >
                            <Minus className="h-3.5 w-3.5" weight="regular" aria-hidden />
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--onda-border)] text-sm transition hover:border-[var(--onda-primary)]/40 hover:bg-[var(--onda-bg)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() =>
                              void setLineQty(line.id, line.quantity + 1)
                            }
                            disabled={lineBusyId === line.id}
                            aria-label="Agregar uno"
                          >
                            <Plus className="h-3.5 w-3.5" weight="regular" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm tabular-nums">×{line.quantity}</span>
                      )}
                    </li>
                  ))
                )}
              </ul>

              <div className="space-y-2 border-t border-[var(--onda-border)] p-3">
                {selectedTab.status === 'OPEN' ? (
                  <>
                    <Button
                      type="button"
                      className="w-full"
                      isDisabled={!selectedTab.lines.length || busy}
                      onClick={() => void checkout()}
                    >
                      {OndaIcons.ticket} Pedir cuenta
                    </Button>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-danger)]/25 hover:bg-[var(--onda-danger)]/8 hover:text-[var(--onda-danger)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void voidTab()}
                    >
                      {OndaIcons.trash} Anular cuenta
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[var(--onda-muted)]">
                        Medio de pago
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {paymentMethods.map((m) => {
                          const active = methodKey === m.key;
                          return (
                            <button
                              key={m.key}
                              type="button"
                              disabled={busy}
                              onClick={() => setMethodKey(m.key)}
                              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary)]/35 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
                                active
                                  ? 'border-[var(--onda-primary)] bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)] shadow-sm'
                                  : 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:border-[var(--onda-primary)]/35 hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]'
                              }`}
                              aria-pressed={active}
                            >
                              {paymentMethodIcon(m.key)}
                              <span className="text-[11px] font-medium leading-tight">
                                {m.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {methodKey === 'cash' ? (
                      <div className="space-y-2">
                        <label className="block space-y-1 text-sm">
                          <span className="text-[var(--onda-muted)]">
                            Efectivo recibido
                          </span>
                          <input
                            className="onda-input w-full tabular-nums text-base font-semibold"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={formatMoneyInput(cashReceived)}
                            onChange={(e) =>
                              setCashReceived(parseMoneyInput(e.target.value))
                            }
                            placeholder={formatMoneyInput(String(selectedTab.total))}
                          />
                        </label>
                        {cashReceived ? (
                          Number(parseMoneyInput(cashReceived) || 0) <
                          selectedTab.total ? (
                            <div className="rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                              Faltan{' '}
                              <span className="font-semibold tabular-nums">
                                {formatCop(
                                  selectedTab.total -
                                    Number(parseMoneyInput(cashReceived) || 0),
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-[var(--onda-success)]/30 bg-[var(--onda-success)]/10 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                                Cambio a devolver
                              </p>
                              <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[var(--onda-ink)]">
                                {formatCop(changeDue)}
                              </p>
                            </div>
                          )
                        ) : (
                          <p className="text-xs text-[var(--onda-muted)]">
                            Total a cobrar:{' '}
                            <span className="font-medium tabular-nums text-[var(--onda-ink)]">
                              {formatCop(selectedTab.total)}
                            </span>
                          </p>
                        )}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      className="w-full"
                      isDisabled={busy}
                      onClick={() => void pay()}
                    >
                      {OndaIcons.dollar} Cobrar {formatCop(selectedTab.total)}
                    </Button>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-[var(--onda-muted)] transition hover:border-[var(--onda-border)] hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void reopen()}
                    >
                      {OndaIcons.edit} Volver a editar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {pickerItem ? (
        <ItemPickerModal
          item={pickerItem}
          busy={busy}
          onCancel={() => setPickerItem(null)}
          onConfirm={(opts) => void addProduct(pickerItem, opts)}
        />
      ) : null}

      {isKiosk && onLeave ? (
        <div className="flex justify-center pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1">
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex min-h-12 min-w-[12rem] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-6 text-sm font-semibold text-[var(--onda-ink)] shadow-[0_8px_24px_rgba(26,27,46,0.06)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onda-primary-500)]/35"
          >
            <CaretLeft className="h-4 w-4" weight="regular" aria-hidden />
            Inicio
          </button>
        </div>
      ) : null}
    </div>
  );
}
