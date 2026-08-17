'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import {
  api,
  getApiUrl,
  OndaIcons,
  setApiAuthTokenGetter,
} from '@onda/shared-ui';

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

type Flash = { tone: 'ok' | 'err'; title: string; detail?: string };

function parseSerial(raw: string) {
  return raw.trim();
}

function PendingList({
  items,
  busyId,
  onResolve,
}: {
  items: PendingItem[];
  busyId: string | null;
  onResolve: (id: string, action: 'confirm' | 'reject') => void;
}) {
  if (!items.length) {
    return (
      <p className="m-auto px-2 text-center text-sm text-[var(--onda-muted)]">
        Sin pendientes. Escanea el QR del cliente para acumular.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {items.map((item) => (
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
              onClick={() => onResolve(item.id, 'confirm')}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              disabled={busyId === item.id}
              onClick={() => onResolve(item.id, 'reject')}
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CajaClient() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);

  const [view, setView] = useState<'scan' | 'pending'>('scan');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem('onda-caja-token', token);
    } catch {
      /* ignore */
    }
    setApiAuthTokenGetter(async () => token);
    return () => setApiAuthTokenGetter(null);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ storeId: string; storeName: string }>(`/caja/session?token=${token}`)
      .then((session) => {
        if (cancelled) return;
        setStoreId(session.storeId);
        setStoreName(session.storeName);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Enlace de caja inválido');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!storeId || !token) return;
    let cancelled = false;
    let source: EventSource | null = null;

    api<PendingItem[]>(`/pending-requests/pending?storeId=${storeId}`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        /* SSE cubre el resto */
      });

    const qs = new URLSearchParams({ storeId, token });
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

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [storeId, token]);

  useEffect(() => {
    if (!storeId || view !== 'scan') return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video,
          (result) => {
            if (!result || scanningRef.current) return;
            const serial = parseSerial(result.getText());
            if (!serial) return;
            void handleScan(serial);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setCamReady(true);
      } catch {
        if (!cancelled) {
          setFlash({
            tone: 'err',
            title: 'No se pudo abrir la cámara',
            detail: 'Revisa el permiso de cámara en este navegador.',
          });
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCamReady(false);
    };
    // handleScan is stable enough via refs; restart only when entering scan view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, view]);

  async function handleScan(serial: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    try {
      const result = await api<{
        pass: { user?: { name?: string }; points: number };
        message?: string;
      }>('/caja/scan', {
        method: 'POST',
        body: JSON.stringify({ serialNumber: serial }),
      });
      setFlash({
        tone: 'ok',
        title: 'Onda acumulada',
        detail:
          result.message ||
          `${result.pass.user?.name || 'Cliente'} · ${result.pass.points} ondas`,
      });
    } catch (err) {
      setFlash({
        tone: 'err',
        title: 'No se pudo acumular',
        detail: err instanceof Error ? err.message : 'Intenta de nuevo',
      });
    } finally {
      window.setTimeout(() => {
        scanningRef.current = false;
        setFlash(null);
      }, 2200);
    }
  }

  async function resolve(id: string, action: 'confirm' | 'reject') {
    setBusyId(id);
    try {
      await api(`/pending-requests/${id}/${action}`, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setFlash({
        tone: 'err',
        title: 'No se pudo resolver',
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-bold">Enlace inválido</h1>
        <p className="text-sm text-[var(--onda-muted)]">{error}</p>
      </main>
    );
  }

  if (!storeId) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--onda-muted)]">
        Abriendo caja…
      </main>
    );
  }

  return (
    <div className={`onda-caja-shell is-${view}`}>
      <header className="onda-caja-top">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
            Caja
          </p>
          <h1 className="font-display text-lg font-bold">{storeName}</h1>
        </div>
        <p className="text-xs text-[var(--onda-muted)]">
          {items.length} pendiente{items.length === 1 ? '' : 's'}
        </p>
      </header>
      <div className="onda-caja-body">
        <section className="onda-caja-scan" aria-label="Escanear QR">
          <video ref={videoRef} muted playsInline className="bg-[var(--onda-ink)]" />
          <div className="onda-caja-scan-frame" />
          {!camReady && !flash ? (
            <p className="onda-caja-flash text-sm text-[var(--onda-muted)]">
              Abriendo cámara…
            </p>
          ) : null}
          {flash ? (
            <div
              className="onda-caja-flash"
              style={{
                borderLeft: `4px solid ${
                  flash.tone === 'ok'
                    ? 'var(--onda-success)'
                    : 'var(--onda-danger)'
                }`,
              }}
            >
              <p className="font-display text-base font-bold">{flash.title}</p>
              {flash.detail ? (
                <p className="mt-1 text-sm text-[var(--onda-muted)]">
                  {flash.detail}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
        <aside className="onda-caja-queue" aria-label="Pendientes">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              Cola
            </p>
            <h2 className="font-display text-base font-bold">Pendientes</h2>
          </div>
          <PendingList items={items} busyId={busyId} onResolve={resolve} />
        </aside>
      </div>
      <nav className="onda-caja-tabs" aria-label="Caja">
        <button
          type="button"
          className={`onda-caja-tab${view === 'scan' ? ' is-active' : ''}`}
          onClick={() => setView('scan')}
        >
          {OndaIcons.camera}
          Escanear
        </button>
        <button
          type="button"
          className={`onda-caja-tab${view === 'pending' ? ' is-active' : ''}`}
          onClick={() => setView('pending')}
        >
          {OndaIcons.qr}
          Pendientes
        </button>
      </nav>
    </div>
  );
}
