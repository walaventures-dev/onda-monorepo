'use client';

import { useEffect, useState } from 'react';
import { api, getApiAuthToken, getApiUrl, OndaIcons, toast } from '@onda/shared-ui';

type PendingItem = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  pass?: { user?: { name?: string } };
  promotion?: { title?: string } | null;
  createdAt: string;
};

type SsePayload = {
  kind?: 'created' | 'resolved';
  id?: string;
  ids?: string[];
  type?: 'ACCUMULATE' | 'CLAIM';
  code?: string;
  customerName?: string;
  promotionTitle?: string;
  createdAt?: string;
};

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

export function PendingRequestsPanel({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    let source: EventSource | null = null;

    async function connect() {
      try {
        const list = await api<PendingItem[]>(
          `/pending-requests/pending?storeId=${storeId}`
        );
        if (!cancelled) setItems(list);
      } catch {
        /* la conexión SSE de abajo seguirá empujando novedades */
      }
      if (cancelled) return;
      const token = await getApiAuthToken();
      const qs = new URLSearchParams({ storeId });
      if (token) qs.set('token', token);
      source = new EventSource(
        `${getApiUrl()}/api/pending-requests/stream?${qs.toString()}`
      );
      source.onmessage = (event) => {
        const payload = JSON.parse(event.data) as SsePayload;
        if (payload.kind === 'resolved' || payload.ids?.length) {
          const ids = new Set(payload.ids || (payload.id ? [payload.id] : []));
          setItems((prev) => prev.filter((i) => !ids.has(i.id)));
          return;
        }
        if (!payload.id || !payload.code || !payload.type) return;
        setItems((prev) => {
          if (prev.some((i) => i.id === payload.id)) return prev;
          return [
            ...prev,
            {
              id: payload.id!,
              type: payload.type!,
              code: payload.code!,
              pass: { user: { name: payload.customerName } },
              promotion: payload.promotionTitle
                ? { title: payload.promotionTitle }
                : null,
              createdAt: payload.createdAt || new Date().toISOString(),
            },
          ];
        });
      };
    }

    void connect();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [storeId]);

  async function resolve(id: string, action: 'confirm' | 'reject') {
    setBusyId(id);
    try {
      await api(`/pending-requests/${id}/${action}`, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
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

  return (
    <aside
      className={`onda-caja-dock${items.length ? '' : ' is-empty'}`}
      aria-label="Acumulaciones pendientes"
    >
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
          Caja
        </p>
        <h2 className="onda-caja-dock-title">Pendientes</h2>
      </div>
      <div className="onda-caja-dock-list">
        {items.length === 0 ? (
          <p className="onda-caja-dock-empty">
            Sin acumulaciones ni reclamos por confirmar.
          </p>
        ) : (
          items.map((item) => (
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
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[var(--onda-success)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={busyId === item.id}
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
          ))
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
  );
}
