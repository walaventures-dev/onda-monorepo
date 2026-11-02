'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Button } from '@heroui/react';
import { PhoneIcon as Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { ListBulletsIcon as ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets';
import { CpuIcon as Cpu } from '@phosphor-icons/react/dist/csr/Cpu';
import { api } from './api';
import { OndaBackButton } from './BackButton';
import { useSwipeNav } from './useSwipeNav';
import { CajaScanClient } from './CajaScanClient';
import { CajaPendingQueue } from './CajaPendingQueue';
import { CajaDevicePanel } from './CajaDevicePanel';
import { PhoneInput } from './PhoneInput';
import { VenderMobile } from './VenderMobile';
import {
  formatCop,
  isCompletePhoneMask,
  ondasFromPayment,
  toE164Colombia,
} from '@onda/shared-utils';
import { SkeletonList } from './Skeleton';
import type { PosTabDto } from '@onda/shared-types';

const CAJA_PANES = ['camera', 'queue', 'device'] as const;
export type CajaPane = (typeof CAJA_PANES)[number];

/**
 * Panel táctil de caja con tres paneles deslizables (cámara, solicitudes,
 * sensores). El pane activo lo controla la ruta vía activePane/onPaneChange,
 * así cada vista tiene URL propia y es navegable con history.
 */
export function CajaDualPane({
  storeId,
  token,
  ondaValue,
  posEnabled,
  activePane,
  onPaneChange,
}: {
  storeId: string;
  token?: string;
  ondaValue?: number | null;
  posEnabled?: boolean;
  activePane: CajaPane;
  onPaneChange: (pane: CajaPane) => void;
}) {
  const [pendingCount, setPendingCount] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const scrollToPane = useCallback(
    (next: CajaPane) => {
      const track = trackRef.current;
      if (!track) return;
      const index = CAJA_PANES.indexOf(next);
      syncingRef.current = true;
      track.scrollTo({
        left: index * track.clientWidth,
        behavior: 'smooth',
      });
      onPaneChange(next);
      window.setTimeout(() => {
        syncingRef.current = false;
      }, 350);
    },
    [onPaneChange],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function onScroll() {
      if (syncingRef.current || !track) return;
      const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
      const next = CAJA_PANES[Math.min(Math.max(index, 0), CAJA_PANES.length - 1)];
      if (next !== activePane) onPaneChange(next);
    }

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [activePane, onPaneChange]);

  // Al montar/cambiar de ruta, alinea el scroll al pane activo sin animar.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const index = CAJA_PANES.indexOf(activePane);
    track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' as ScrollBehavior });
  }, [activePane]);

  const badge = pendingCount > 99 ? '99+' : String(pendingCount);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="onda-caja-tabs" role="tablist" aria-label="Vista de caja">
        <button
          type="button"
          role="tab"
          aria-selected={activePane === 'camera'}
          className={`onda-caja-tab${activePane === 'camera' ? ' is-active' : ''}`}
          onClick={() => scrollToPane('camera')}
        >
          <QrCode className="h-5 w-5" weight="regular" aria-hidden />
          Cámara
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePane === 'queue'}
          className={`onda-caja-tab${activePane === 'queue' ? ' is-active' : ''}`}
          onClick={() => scrollToPane('queue')}
        >
          <ListBullets className="h-5 w-5" weight="regular" aria-hidden />
          Solicitudes
          {pendingCount > 0 ? (
            <span className="onda-caja-tab-badge">{badge}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePane === 'device'}
          className={`onda-caja-tab${activePane === 'device' ? ' is-active' : ''}`}
          onClick={() => scrollToPane('device')}
        >
          <Cpu className="h-5 w-5" weight="regular" aria-hidden />
          Sensores
        </button>
      </div>

      <div ref={trackRef} className="onda-caja-swipe">
        <section
          className="onda-caja-swipe-pane"
          aria-label="Escanear QR"
          aria-hidden={activePane !== 'camera'}
        >
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <CajaScanClient
              storeId={storeId}
              token={token}
              embedded
              hideHeader
              posEnabled={posEnabled}
              active={activePane === 'camera'}
            />
          </div>
        </section>
        <section
          className="onda-caja-swipe-pane"
          aria-label="Solicitudes pendientes"
          aria-hidden={activePane !== 'queue'}
        >
          <CajaPendingQueue
            storeId={storeId}
            ondaValue={ondaValue}
            onCountChange={setPendingCount}
          />
        </section>
        <section
          className="onda-caja-swipe-pane"
          aria-label="Sensores del dispositivo"
          aria-hidden={activePane !== 'device'}
        >
          <CajaDevicePanel />
        </section>
      </div>
    </div>
  );
}

function QrLinkScanner({
  onScan,
  disabled,
}: {
  onScan: (payload: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    void reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        video,
        (result) => {
          if (!result || scanningRef.current || disabled) return;
          const text = result.getText().trim();
          if (!text) return;
          scanningRef.current = true;
          onScan(text);
          window.setTimeout(() => {
            scanningRef.current = false;
          }, 2000);
        }
      )
      .then((controls) => {
        if (cancelled) controls.stop();
      })
      .catch(() => {
        /* cámara no disponible */
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, onScan]);

  return (
    <div className="onda-caja-scan relative mt-2 overflow-hidden rounded-2xl">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
      <div className="onda-caja-scan-frame" />
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <OndaBackButton onClick={onClick} label={label} />;
}

export function AsociarVentaList({
  storeId,
  onSelect,
  token,
}: {
  storeId: string;
  onSelect: (tabId: string) => void;
  token?: string;
}) {
  const [tabs, setTabs] = useState<PosTabDto[]>([]);

  const loadTabs = useCallback(async () => {
    const qs = new URLSearchParams({
      storeId,
      status: 'OPEN,CHECKOUT',
    });
    if (token) qs.set('token', token);
    const rows = await api<PosTabDto[]>(`/pos/tabs?${qs.toString()}`);
    setTabs(rows);
  }, [storeId, token]);

  useEffect(() => {
    void loadTabs();
    const qs = new URLSearchParams({ storeId });
    if (token) qs.set('token', token);
    const es = new EventSource(`/api/pos/stream?${qs.toString()}`);
    es.onmessage = () => void loadTabs();
    return () => es.close();
  }, [storeId, token, loadTabs]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)]">
          <Receipt className="h-8 w-8" weight="regular" aria-hidden />
        </span>
        <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          Sin cuentas
        </p>
        <p className="max-w-[16rem] text-sm text-[var(--onda-muted)]">
          Ábrelas en Vender (caja o panel del comercio).
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tabs.map((tab) => {
        const linked = Boolean(tab.passId);
        return (
          <li key={tab.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 text-left shadow-[0_8px_24px_rgba(26,27,46,0.06)] transition active:scale-[0.98]"
              onClick={() => onSelect(tab.id)}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                  linked
                    ? 'bg-[var(--onda-success)]/15 text-[var(--onda-success)]'
                    : 'bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)]'
                }`}
              >
                {linked ? (
                  <UserCircle className="h-8 w-8" weight="regular" aria-hidden />
                ) : (
                  <Receipt className="h-8 w-8" weight="regular" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold text-[var(--onda-ink)]">
                  {tab.label}
                </p>
                <p className="truncate text-sm text-[var(--onda-muted)]">
                  {linked
                    ? tab.customerName || 'Cliente listo'
                    : 'Toca para asociar'}
                </p>
              </div>
              <p className="shrink-0 font-display text-xl font-bold tabular-nums text-[var(--onda-ink)]">
                {formatCop(tab.total)}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function AsociarVentaDetail({
  storeId,
  tabId,
  onBack,
  token,
  ondaValue,
}: {
  storeId: string;
  tabId: string;
  onBack: () => void;
  token?: string;
  ondaValue?: number | null;
}) {
  const [tab, setTab] = useState<PosTabDto | null>(null);
  const [phone, setPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [mode, setMode] = useState<'qr' | 'phone'>('qr');
  const rootRef = useRef<HTMLDivElement>(null);

  useSwipeNav(rootRef, { onBack: onBack, enabled: !linking });

  const reload = useCallback(async () => {
    const qs = new URLSearchParams({
      storeId,
      status: 'OPEN,CHECKOUT',
    });
    if (token) qs.set('token', token);
    const tabs = await api<PosTabDto[]>(`/pos/tabs?${qs.toString()}`);
    setTab(tabs.find((t) => t.id === tabId) ?? null);
  }, [storeId, tabId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function linkPhone() {
    if (!isCompletePhoneMask(phone)) return;
    setLinking(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ storeId });
      if (token) qs.set('token', token);
      const updated = await api<PosTabDto>(
        `/pos/tabs/${tabId}/link-phone?${qs.toString()}`,
        {
          method: 'POST',
          body: JSON.stringify({ phone: toE164Colombia(phone) }),
        }
      );
      setTab(updated);
      setPhone('');
      setMessage({ tone: 'ok', text: 'Cliente asociado' });
    } catch (err) {
      setMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'No se pudo asociar',
      });
    } finally {
      setLinking(false);
    }
  }

  const linkPass = useCallback(
    async (payload: string) => {
      setLinking(true);
      setMessage(null);
      try {
        const qs = new URLSearchParams({ storeId });
        if (token) qs.set('token', token);
        const updated = await api<PosTabDto>(
          `/pos/tabs/${tabId}/link-pass?${qs.toString()}`,
          {
            method: 'POST',
            body: JSON.stringify({ payload: payload.trim() }),
          }
        );
        setTab(updated);
        setMessage({ tone: 'ok', text: 'Cliente asociado' });
      } catch (err) {
        setMessage({
          tone: 'err',
          text: err instanceof Error ? err.message : 'No se pudo asociar',
        });
      } finally {
        setLinking(false);
      }
    },
    [storeId, tabId, token]
  );

  if (!tab) {
    return <SkeletonList rows={3} />;
  }

  if (tab.status !== 'OPEN' && tab.status !== 'CHECKOUT') {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-sm text-[var(--onda-muted)]">Esta cuenta ya cerró.</p>
        <BackButton onClick={onBack} label="Volver" />
      </div>
    );
  }

  const value =
    ondaValue != null && Number(ondaValue) > 0 ? Number(ondaValue) : null;
  const previewOndas =
    tab.passId && value != null
      ? ondasFromPayment(tab.total, value)
      : null;

  return (
    <div ref={rootRef} className="flex min-h-full flex-1 flex-col gap-4">
      <BackButton onClick={onBack} label="Cuentas" />

      <div className="rounded-2xl bg-[var(--onda-primary-50)] px-4 py-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
          {tab.label}
        </p>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums text-[var(--onda-ink)]">
          {formatCop(tab.total)}
        </p>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          {tab.lines.length} producto{tab.lines.length === 1 ? '' : 's'}
        </p>
      </div>

      {message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${
            message.tone === 'ok'
              ? 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]'
              : 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {tab.passId ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--onda-success)]/25 bg-[var(--onda-success)]/10 px-4 py-8 text-center">
          <UserCircle
            className="h-14 w-14 text-[var(--onda-success)]"
            weight="regular"
            aria-hidden
          />
          <p className="font-display text-xl font-semibold text-[var(--onda-ink)]">
            {tab.customerName || 'Cliente listo'}
          </p>
          <p className="text-sm text-[var(--onda-muted)]">
            {previewOndas == null
              ? 'Ondas al cobrar en el POS'
              : previewOndas > 0
                ? `+${previewOndas} onda${previewOndas === 1 ? '' : 's'} al cobrar`
                : '+0 ondas al cobrar (venta registrada)'}
          </p>
          <Button size="lg" fullWidth className="mt-2 min-h-14" onPress={onBack}>
            Listo
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('qr')}
              className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-base font-semibold transition active:scale-[0.98] ${
                mode === 'qr'
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]'
                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)]'
              }`}
            >
              <QrCode className="h-7 w-7" weight="regular" aria-hidden />
              Escanear
            </button>
            <button
              type="button"
              onClick={() => setMode('phone')}
              className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-base font-semibold transition active:scale-[0.98] ${
                mode === 'phone'
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)]'
                  : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)]'
              }`}
            >
              <Phone className="h-7 w-7" weight="regular" aria-hidden />
              Celular
            </button>
          </div>

          {mode === 'qr' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-1 text-center text-sm text-[var(--onda-muted)]">
                Apunta al QR del pase
              </p>
              <QrLinkScanner
                onScan={(p) => void linkPass(p)}
                disabled={linking}
              />
            </div>
          ) : (
            <div className="mt-auto space-y-3 rounded-2xl border border-[var(--onda-border)] p-4 pb-2">
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className="onda-input min-h-14 w-full text-center text-xl"
                disabled={linking}
              />
              <Button
                size="lg"
                fullWidth
                className="min-h-14"
                onPress={() => void linkPhone()}
                isDisabled={linking || !isCompletePhoneMask(phone)}
              >
                {linking ? 'Asociando…' : 'Asociar'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

