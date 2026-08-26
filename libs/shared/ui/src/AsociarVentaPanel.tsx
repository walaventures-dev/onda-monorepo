'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Button } from '@heroui/react';
import { api } from './api';
import { CajaScanClient } from './CajaScanClient';
import { formatCop } from '@onda/shared-utils';
import type { PosTabDto } from '@onda/shared-types';

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
    <div className="onda-caja-scan mt-2 min-h-[14rem] rounded-xl overflow-hidden">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <div className="onda-caja-scan-frame" />
    </div>
  );
}

export function AsociarVentaList({
  storeId,
  onSelect,
}: {
  storeId: string;
  onSelect: (tabId: string) => void;
}) {
  const [tabs, setTabs] = useState<PosTabDto[]>([]);

  const loadTabs = useCallback(async () => {
    const rows = await api<PosTabDto[]>(
      `/pos/tabs?storeId=${storeId}&status=OPEN,CHECKOUT`
    );
    setTabs(rows);
  }, [storeId]);

  useEffect(() => {
    void loadTabs();
    const es = new EventSource(`/api/pos/stream?storeId=${storeId}`);
    es.onmessage = () => void loadTabs();
    return () => es.close();
  }, [storeId, loadTabs]);

  return (
    <ul className="space-y-3">
      {tabs.map((tab) => (
        <li key={tab.id}>
          <button
            type="button"
            className="onda-card w-full p-4 text-left transition hover:border-[var(--onda-primary-500)]/40"
            onClick={() => onSelect(tab.id)}
          >
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-[var(--onda-ink)]">{tab.label}</span>
              <span className="tabular-nums text-[var(--onda-ink)]">{formatCop(tab.total)}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--onda-muted)]">
              {tab.passId ? tab.customerName || 'Cliente vinculado' : 'Anónimo'} · {tab.status}
            </p>
          </button>
        </li>
      ))}
      {tabs.length === 0 ? (
        <li className="py-8 text-center text-sm text-[var(--onda-muted)]">
          No hay ventas abiertas en este momento.
        </li>
      ) : null}
    </ul>
  );
}

export function AsociarVentaDetail({
  storeId,
  tabId,
  onBack,
}: {
  storeId: string;
  tabId: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<PosTabDto | null>(null);
  const [phone, setPhone] = useState('');
  const [guestName, setGuestName] = useState('');
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [mode, setMode] = useState<'phone' | 'qr'>('qr');

  const reload = useCallback(async () => {
    const tabs = await api<PosTabDto[]>(
      `/pos/tabs?storeId=${storeId}&status=OPEN,CHECKOUT`
    );
    setTab(tabs.find((t) => t.id === tabId) ?? null);
  }, [storeId, tabId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function linkPhone() {
    setLinking(true);
    setMessage(null);
    try {
      const updated = await api<PosTabDto>(`/pos/tabs/${tabId}/link-phone?storeId=${storeId}`, {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          guestName: guestName.trim() || undefined,
        }),
      });
      setTab(updated);
      setPhone('');
      setGuestName('');
      setMessage({ tone: 'ok', text: 'Cliente vinculado por teléfono.' });
    } catch (err) {
      setMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'No se pudo vincular',
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
        const updated = await api<PosTabDto>(
          `/pos/tabs/${tabId}/link-pass?storeId=${storeId}`,
          {
            method: 'POST',
            body: JSON.stringify({ payload: payload.trim() }),
          }
        );
        setTab(updated);
        setMessage({ tone: 'ok', text: 'Pase vinculado. Ondas al cerrar la venta.' });
      } catch (err) {
        setMessage({
          tone: 'err',
          text: err instanceof Error ? err.message : 'No se pudo vincular el pase',
        });
      } finally {
        setLinking(false);
      }
    },
    [storeId, tabId]
  );

  if (!tab) {
    return <p className="text-sm text-[var(--onda-muted)]">Cargando venta…</p>;
  }

  if (tab.status !== 'OPEN' && tab.status !== 'CHECKOUT') {
    return (
      <div className="text-sm text-[var(--onda-muted)]">
        <p>Esta venta ya no está activa.</p>
        <button type="button" className="mt-3 text-[var(--onda-primary)]" onClick={onBack}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="text-sm font-medium text-[var(--onda-primary)]"
        onClick={onBack}
      >
        ← Ventas activas
      </button>
      <div>
        <h3 className="font-display text-lg font-semibold text-[var(--onda-ink)]">
          {tab.label}
        </h3>
        <p className="text-sm text-[var(--onda-muted)]">
          {formatCop(tab.total)} · {tab.status}
        </p>
      </div>

      <ul className="divide-y divide-[var(--onda-border)] text-sm">
        {tab.lines.map((l) => (
          <li key={l.id} className="flex justify-between py-2">
            <span className="text-[var(--onda-ink)]">
              {l.quantity}× {l.item?.name ?? l.itemId}
            </span>
            <span className="tabular-nums">{formatCop(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>

      {message ? (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            message.tone === 'ok'
              ? 'bg-[var(--onda-success)]/10 text-[var(--onda-success)]'
              : 'bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {tab.passId ? (
        <div className="onda-card p-4">
          <p className="font-medium text-[var(--onda-ink)]">
            {tab.customerName || 'Cliente vinculado'}
          </p>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            Al cobrar en el POS se otorgan ondas automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-[var(--onda-ink)]">Vincular cliente</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'qr' ? 'primary' : 'ghost'}
              onPress={() => setMode('qr')}
            >
              Escanear QR
            </Button>
            <Button
              size="sm"
              variant={mode === 'phone' ? 'primary' : 'ghost'}
              onPress={() => setMode('phone')}
            >
              Teléfono
            </Button>
          </div>

          {mode === 'qr' ? (
            <div>
              <p className="mb-2 text-sm text-[var(--onda-muted)]">
                Apunta la cámara al QR del pase del cliente.
              </p>
              <QrLinkScanner onScan={(p) => void linkPass(p)} disabled={linking} />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--onda-muted)]">Teléfono</span>
                <input
                  className="onda-input w-full"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--onda-muted)]">Nombre (si es nuevo)</span>
                <input
                  className="onda-input w-full"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </label>
              <Button
                className="w-full"
                onPress={() => void linkPhone()}
                isDisabled={linking || !phone.replace(/\D/g, '')}
              >
                Vincular
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CajaOperationsPanel({
  storeId,
  defaultMode = 'acumular',
  posEnabled = false,
}: {
  storeId: string;
  defaultMode?: 'acumular' | 'asociar';
  posEnabled?: boolean;
}) {
  const [mode, setMode] = useState<'acumular' | 'asociar'>(
    posEnabled ? defaultMode : 'acumular'
  );
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!posEnabled) setMode('acumular');
  }, [posEnabled]);

  if (selectedTabId) {
    return (
      <AsociarVentaDetail
        storeId={storeId}
        tabId={selectedTabId}
        onBack={() => setSelectedTabId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {posEnabled ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mode === 'acumular' ? 'primary' : 'ghost'}
            onPress={() => setMode('acumular')}
          >
            Acumular / Redimir
          </Button>
          <Button
            size="sm"
            variant={mode === 'asociar' ? 'primary' : 'ghost'}
            onPress={() => setMode('asociar')}
          >
            Asociar venta activa
          </Button>
        </div>
      ) : null}

      {mode === 'acumular' || !posEnabled ? (
        <div className="onda-card overflow-hidden p-0">
          <CajaScanClient storeId={storeId} embedded hideHeader posEnabled={posEnabled} />
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-[var(--onda-muted)]">
            Elige una cuenta abierta para vincularla con teléfono o QR del pase.
          </p>
          <AsociarVentaList storeId={storeId} onSelect={setSelectedTabId} />
        </div>
      )}
    </div>
  );
}
