'use client';

import { useState } from 'react';
import {
  api,
  OndaIcons,
  toast,
  CajaPendingQueue,
} from '@onda/shared-ui';

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
  const [count, setCount] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [open, setOpen] = useState(false);
  const badge = count > 99 ? '99+' : String(count);

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
          <CajaPendingQueue
            storeId={storeId}
            ondaValue={ondaValue}
            onStoreActivity={onStoreActivity}
            onCountChange={setCount}
          />
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
