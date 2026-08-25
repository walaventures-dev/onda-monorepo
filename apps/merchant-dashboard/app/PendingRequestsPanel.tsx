'use client';

import { useEffect, useRef, useState } from 'react';
import { api, getApiAuthToken, getApiUrl, OndaIcons, toast } from '@onda/shared-ui';
import {
  formatMoneyInput,
  parseMoneyInput,
  ondasFromPayment,
  needsClaimPaymentAmount,
  needsClaimBenefitInput,
  formatCop,
} from '@onda/shared-utils';

type PendingItem = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  pass?: { user?: { name?: string } };
  promotion?: {
    title?: string;
    type?: string;
    value?: number | null;
  } | null;
  createdAt: string;
};

type SsePayload = {
  kind?: 'created' | 'resolved' | 'ping' | 'activity';
  id?: string;
  ids?: string[];
  type?: 'ACCUMULATE' | 'CLAIM' | 'REDEEM';
  code?: string;
  customerName?: string;
  promotionTitle?: string;
  promotionType?: string;
  promotionValue?: number | null;
  createdAt?: string;
  passId?: string;
};

function itemFromSse(payload: SsePayload): PendingItem | null {
  if (!payload.id || !payload.code || !payload.type) return null;
  return {
    id: payload.id,
    type: payload.type,
    code: payload.code,
    pass: { user: { name: payload.customerName } },
    promotion: payload.promotionTitle
      ? {
          title: payload.promotionTitle,
          type: payload.promotionType,
          value: payload.promotionValue,
        }
      : null,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

export function CajaOpenButton({ storeId }: { storeId: string }) {
  const [busy, setBusy] = useState(false);

  async function openCaja() {
    if (!storeId) return;
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>('/caja/link', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo abrir caja');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openCaja()}
      disabled={busy || !storeId}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)] disabled:opacity-50"
    >
      {OndaIcons.qr}
      Abrir caja
    </button>
  );
}

export function PendingRequestsPanel({
  storeId,
  ondaValue,
  onStoreActivity,
}: {
  storeId: string;
  ondaValue?: number | null;
  /** Se dispara tras cada acumulación o canje confirmado (SSE o confirm local). */
  onStoreActivity?: () => void;
}) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [pointsById, setPointsById] = useState<Record<string, string>>({});
  const [benefitsById, setBenefitsById] = useState<Record<string, string>>({});
  const removedRef = useRef(new Set<string>());
  const onActivityRef = useRef(onStoreActivity);
  onActivityRef.current = onStoreActivity;
  const hasOndaValue = ondaValue != null && Number(ondaValue) > 0;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer = 0;
    removedRef.current = new Set();
    setItems([]);

    function applyCreated(item: PendingItem) {
      if (removedRef.current.has(item.id)) return;
      setItems((prev) =>
        prev.some((row) => row.id === item.id) ? prev : [...prev, item]
      );
    }

    function applyResolved(ids: string[]) {
      ids.forEach((id) => removedRef.current.add(id));
      setItems((prev) => prev.filter((row) => !ids.includes(row.id)));
    }

    function handlePayload(raw: string) {
      const payload = JSON.parse(raw) as SsePayload;
      if (payload.kind === 'ping') return;
      if (payload.kind === 'activity') {
        onActivityRef.current?.();
        return;
      }
      if (payload.kind === 'resolved' || payload.ids?.length) {
        applyResolved(payload.ids || (payload.id ? [payload.id] : []));
        return;
      }
      const item = itemFromSse(payload);
      if (item) applyCreated(item);
    }

    async function loadSnapshot() {
      try {
        const list = await api<PendingItem[]>(
          `/pending-requests/pending?storeId=${storeId}`
        );
        if (cancelled) return;
        setItems((prev) => {
          const merged = new Map<string, PendingItem>();
          for (const row of list) {
            if (!removedRef.current.has(row.id)) merged.set(row.id, row);
          }
          for (const row of prev) {
            if (!removedRef.current.has(row.id)) merged.set(row.id, row);
          }
          return [...merged.values()];
        });
      } catch {
        /* SSE cubre el resto */
      }
    }

    async function connect() {
      if (cancelled) return;
      source?.close();
      const token = await getApiAuthToken();
      if (cancelled) return;
      const qs = new URLSearchParams({ storeId });
      if (token) qs.set('token', token);
      source = new EventSource(
        `${getApiUrl()}/api/pending-requests/stream?${qs.toString()}`
      );
      source.onmessage = (event) => handlePayload(event.data);
      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          void connect();
          void loadSnapshot();
        }, 2000);
      };
    }

    void connect();
    void loadSnapshot();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadSnapshot();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, [storeId]);

  function canConfirm(item: PendingItem): boolean {
    const precio = Number(parseMoneyInput(amounts[item.id] || ''));
    if (item.type === 'ACCUMULATE') {
      if (!(Number.isFinite(precio) && precio > 0)) return false;
      if (!hasOndaValue) {
        const pts = Number(pointsById[item.id] || '');
        return Number.isFinite(pts) && pts >= 1;
      }
      return ondasFromPayment(precio, Number(ondaValue)) >= 1;
    }
    const promoType = item.promotion?.type || 'OTHER';
    if (needsClaimPaymentAmount(promoType)) {
      return Number.isFinite(precio) && precio > 0;
    }
    if (needsClaimBenefitInput(promoType, item.promotion?.value)) {
      const ben = Number(parseMoneyInput(benefitsById[item.id] || ''));
      return Number.isFinite(ben) && ben > 0;
    }
    return true;
  }

  async function resolve(id: string, action: 'confirm' | 'reject') {
    const item = items.find((row) => row.id === id);
    if (action === 'confirm' && item && !canConfirm(item)) return;

    const precio = Number(parseMoneyInput(amounts[id] || ''));
    const pts = Number(pointsById[id] || '');
    const ben = Number(parseMoneyInput(benefitsById[id] || ''));

    setBusyId(id);
    try {
      const body: Record<string, number> = {};
      if (action === 'confirm' && item) {
        if (Number.isFinite(precio) && precio > 0) body.paymentAmount = precio;
        if (item.type === 'ACCUMULATE' && !hasOndaValue && Number.isFinite(pts)) {
          body.points = pts;
        }
        if (
          item.type === 'CLAIM' &&
          needsClaimBenefitInput(
            item.promotion?.type || 'OTHER',
            item.promotion?.value
          ) &&
          Number.isFinite(ben) &&
          ben > 0
        ) {
          body.benefitAmount = ben;
        }
      }
      await api(`/pending-requests/${id}/${action}`, {
        method: 'POST',
        body:
          action === 'confirm' && Object.keys(body).length
            ? JSON.stringify(body)
            : undefined,
      });
      removedRef.current.add(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setAmounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPointsById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBenefitsById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo resolver');
    } finally {
      setBusyId(null);
    }
  }

  async function rotateLink() {
    if (!storeId) return;
    setRotating(true);
    try {
      const { url } = await api<{ url: string }>('/caja/link', {
        method: 'POST',
        body: JSON.stringify({ storeId, rotate: true }),
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo regenerar el enlace');
    } finally {
      setRotating(false);
    }
  }

  const count = items.length;
  const badge = count > 99 ? '99+' : String(count);

  return (
    <>
      <button
        type="button"
        className={`onda-caja-dock-toggle${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls="onda-caja-dock"
        aria-label={
          count
            ? `Pendientes de caja, ${count}`
            : open
              ? 'Cerrar pendientes de caja'
              : 'Abrir pendientes de caja'
        }
        onClick={() => setOpen((v) => !v)}
      >
        {OndaIcons.qr}
        {count > 0 ? <span className="onda-caja-dock-badge">{badge}</span> : null}
      </button>
      <aside
        id="onda-caja-dock"
        className={`onda-caja-dock${open ? ' is-open' : ''}`}
        aria-label="Acumulaciones pendientes"
        aria-hidden={!open}
      >
        <div className="onda-caja-dock-head">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              Caja
            </p>
            <h2 className="onda-caja-dock-title">
              Pendientes{count ? ` · ${count}` : ''}
            </h2>
            {hasOndaValue ? (
              <p className="mt-0.5 text-[0.7rem] text-[var(--onda-muted)]">
                Una onda cuesta {formatCop(Number(ondaValue))}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="onda-caja-dock-close"
            aria-label="Cerrar pendientes"
            onClick={() => setOpen(false)}
          >
            {OndaIcons.close}
          </button>
        </div>
        <div className="onda-caja-dock-list">
          {count === 0 ? (
            <p className="onda-caja-dock-empty">
              Sin acumulaciones ni reclamos por confirmar.
            </p>
          ) : (
            items.map((item) => {
              const promoType = item.promotion?.type || 'OTHER';
              const precioNum = Number(parseMoneyInput(amounts[item.id] || ''));
              const previewOndas =
                item.type === 'ACCUMULATE' &&
                hasOndaValue &&
                Number.isFinite(precioNum) &&
                precioNum > 0
                  ? ondasFromPayment(precioNum, Number(ondaValue))
                  : null;
              const askClaimTicket =
                item.type === 'CLAIM' && needsClaimPaymentAmount(promoType);
              const askClaimBenefit =
                item.type === 'CLAIM' &&
                needsClaimBenefitInput(promoType, item.promotion?.value);

              return (
                <div
                  key={item.id}
                  className="space-y-2 rounded-xl border border-[var(--onda-border)] p-3"
                >
                  <p className="text-sm font-semibold">
                    {item.type === 'ACCUMULATE'
                      ? 'Acumular onda'
                      : `Reclamar: ${item.promotion?.title || 'premio'}`}
                  </p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {item.pass?.user?.name || 'Cliente'}
                  </p>
                  <p className="font-display text-center text-3xl font-bold tracking-[0.2em] text-[var(--onda-primary-500)]">
                    {item.code}
                  </p>
                  {item.type === 'ACCUMULATE' || askClaimTicket ? (
                    <label className="block">
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                        Valor de la cuenta
                      </span>
                      <span className="mt-1 flex items-center gap-1 rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-2">
                        <span className="text-sm text-[var(--onda-muted)]">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          className="w-full bg-transparent text-sm text-[var(--onda-ink)] outline-none"
                          value={formatMoneyInput(amounts[item.id] || '')}
                          onChange={(e) =>
                            setAmounts((prev) => ({
                              ...prev,
                              [item.id]: parseMoneyInput(e.target.value),
                            }))
                          }
                          aria-label="Valor de la cuenta"
                        />
                      </span>
                      {previewOndas != null ? (
                        <span className="mt-1 block text-xs text-[var(--onda-muted)]">
                          {previewOndas > 0
                            ? `→ ${previewOndas} onda${previewOndas === 1 ? '' : 's'}`
                            : 'El monto no alcanza para 1 onda'}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  {item.type === 'ACCUMULATE' && !hasOndaValue ? (
                    <label className="block">
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                        Ondas a acumular
                      </span>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={pointsById[item.id] || ''}
                        onChange={(e) =>
                          setPointsById((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        aria-label="Ondas a acumular"
                      />
                    </label>
                  ) : null}
                  {askClaimBenefit ? (
                    <label className="block">
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                        Valor del beneficio (COP)
                      </span>
                      <span className="mt-1 flex items-center gap-1 rounded-xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-2">
                        <span className="text-sm text-[var(--onda-muted)]">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          className="w-full bg-transparent text-sm text-[var(--onda-ink)] outline-none"
                          value={formatMoneyInput(benefitsById[item.id] || '')}
                          onChange={(e) =>
                            setBenefitsById((prev) => ({
                              ...prev,
                              [item.id]: parseMoneyInput(e.target.value),
                            }))
                          }
                          aria-label="Valor del beneficio"
                        />
                      </span>
                    </label>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-full bg-[var(--onda-success)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      disabled={busyId === item.id || !canConfirm(item)}
                      onClick={() => resolve(item.id, 'confirm')}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => resolve(item.id, 'reject')}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-xs font-medium text-[var(--onda-muted)] disabled:opacity-50"
          disabled={rotating || !storeId}
          onClick={() => void rotateLink()}
        >
          Regenerar enlace de caja
        </button>
      </aside>
    </>
  );
}
