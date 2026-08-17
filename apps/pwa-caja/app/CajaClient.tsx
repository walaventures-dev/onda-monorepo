'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import {
  api,
  OndaHandMark,
  setApiAuthTokenGetter,
} from '@onda/shared-ui';
import { formatMoneyInput, parseMoneyInput } from '@onda/shared-utils';

type Flash = { tone: 'ok' | 'err'; title: string; detail?: string };

type Burst =
  | { phase: 'working' }
  | { phase: 'ok'; name?: string; points?: number }
  | { phase: 'claim'; name?: string; title?: string }
  | { phase: 'err'; title: string; detail?: string };

function CajaBurst({
  burst,
  onDismiss,
}: {
  burst: Burst;
  onDismiss: () => void;
}) {
  const title =
    burst.phase === 'working'
      ? 'Un momento…'
      : burst.phase === 'ok'
        ? '+1 onda'
        : burst.phase === 'claim'
          ? '¡Premio!'
          : burst.title;
  const detail =
    burst.phase === 'working'
      ? 'Validando el pase'
      : burst.phase === 'ok'
        ? burst.points != null
          ? `${burst.name || 'Cliente'} · ${burst.points} ondas`
          : burst.name || 'Listo'
        : burst.phase === 'claim'
          ? [burst.title, burst.name].filter(Boolean).join(' · ') || 'Entregado'
          : burst.detail;

  return (
    <div
      className={`onda-caja-burst is-${burst.phase}`}
      role="status"
      aria-live="assertive"
      onClick={burst.phase === 'working' ? undefined : onDismiss}
    >
      <div className="onda-caja-burst-stage" aria-hidden>
        {burst.phase === 'ok' || burst.phase === 'claim' ? (
          <>
            <span className="onda-caja-burst-ripple" />
            <span className="onda-caja-burst-ripple" />
            {burst.phase === 'claim' ? (
              <>
                <span className="onda-caja-burst-ripple" />
                <span className="onda-caja-burst-confetti" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </>
            ) : null}
          </>
        ) : null}
        <OndaHandMark
          variant={
            burst.phase === 'err' || burst.phase === 'claim'
              ? 'onPrimary'
              : 'default'
          }
          className="onda-caja-burst-hand"
        />
      </div>
      <div className="onda-caja-burst-copy">
        <h2 className="font-display">{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
    </div>
  );
}

function CajaAmountSheet({
  amount,
  currency,
  onAmount,
  onCancel,
  onConfirm,
}: {
  amount: string;
  currency: string;
  onAmount: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ready = Boolean(parseMoneyInput(amount));
  return (
    <div className="onda-caja-amount" role="dialog" aria-labelledby="onda-caja-amount-title">
      <form
        className="onda-caja-amount-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm();
        }}
      >
        <p className="onda-caja-amount-kicker">Acumular onda</p>
        <h2 id="onda-caja-amount-title" className="font-display">
          Valor de la cuenta
        </h2>
        <label className="onda-caja-amount-field">
          <span className="onda-caja-amount-prefix">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9.]*"
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
            value={formatMoneyInput(amount)}
            onChange={(e) => onAmount(parseMoneyInput(e.target.value))}
            aria-label="Valor de la cuenta"
          />
          <span className="onda-caja-amount-currency">{currency}</span>
        </label>
        <button type="submit" className="onda-caja-amount-submit" disabled={!ready}>
          Acumular
        </button>
        <button type="button" className="onda-caja-amount-cancel" onClick={onCancel}>
          Cancelar
        </button>
      </form>
    </div>
  );
}

function parseSerial(raw: string) {
  return raw.trim();
}

export function CajaClient() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);

  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<Flash | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [draft, setDraft] = useState<{ serial: string; amount: string } | null>(
    null
  );
  const burstTimerRef = useRef<number>(0);

  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem('onda-caja-token', token);
    } catch {
      /* ignore */
    }
    setApiAuthTokenGetter(async () => token);
    return () => {
      setApiAuthTokenGetter(null);
      window.clearTimeout(burstTimerRef.current);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ storeId: string; storeName: string; currency?: string }>(
      `/caja/session?token=${token}`
    )
      .then((session) => {
        if (cancelled) return;
        setStoreId(session.storeId);
        setStoreName(session.storeName);
        if (session.currency) setCurrency(session.currency);
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
    if (!storeId) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video ?? undefined,
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
    // handleScan is stable enough via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function clearBurst() {
    window.clearTimeout(burstTimerRef.current);
    setBurst(null);
    scanningRef.current = false;
  }

  function cancelDraft() {
    setDraft(null);
    scanningRef.current = false;
  }

  function showBurst(next: Burst, ms: number) {
    setBurst(next);
    window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      setBurst(null);
      scanningRef.current = false;
    }, ms);
  }

  function handleScan(serial: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    void resolveScan(serial);
  }

  async function resolveScan(serial: string, precio?: number) {
    setBurst({ phase: 'working' });
    try {
      const result = await api<{
        kind?: 'redeem' | 'accumulate' | 'accumulated';
        pass?: { user?: { name?: string }; points: number };
        promotion?: { title?: string };
        message?: string;
      }>('/caja/scan', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber: serial,
          ...(precio != null ? { precio } : {}),
        }),
      });
      if (result.kind === 'redeem') {
        showBurst(
          {
            phase: 'claim',
            name: result.pass?.user?.name,
            title: result.promotion?.title,
          },
          3200
        );
        return;
      }
      if (result.kind === 'accumulate') {
        setBurst(null);
        setDraft({ serial, amount: '' });
        return;
      }
      showBurst(
        {
          phase: 'ok',
          name: result.pass?.user?.name,
          points: result.pass?.points,
        },
        2400
      );
    } catch (err) {
      showBurst(
        {
          phase: 'err',
          title: precio != null ? 'No se pudo acumular' : 'No se pudo validar',
          detail: err instanceof Error ? err.message : 'Intenta de nuevo',
        },
        2200
      );
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    const precio = Number(parseMoneyInput(draft.amount));
    const serial = draft.serial;
    setDraft(null);
    await resolveScan(
      serial,
      Number.isFinite(precio) && precio > 0 ? precio : undefined
    );
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
    <div className="onda-caja-shell is-scan-only">
      <header className="onda-caja-top">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
            Caja
          </p>
          <h1 className="font-display text-lg font-bold">{storeName}</h1>
        </div>
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
      </div>
      {draft ? (
        <CajaAmountSheet
          amount={draft.amount}
          currency={currency}
          onAmount={(amount) => setDraft((prev) => (prev ? { ...prev, amount } : prev))}
          onCancel={cancelDraft}
          onConfirm={() => void confirmDraft()}
        />
      ) : null}
      {burst ? <CajaBurst burst={burst} onDismiss={clearBurst} /> : null}
    </div>
  );
}
