'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { api, setApiAuthTokenGetter } from './api';
import { Skeleton, SkeletonList, SkeletonScreen } from './Skeleton';
import { OndaHandMark } from './brand';
import {
  formatMoneyInput,
  parseMoneyInput,
  ondasFromPayment,
  formatCop,
  manualOndasOrDefault,
} from '@onda/shared-utils';
import type { PosTabDto } from '@onda/shared-types';

type Flash = { tone: 'ok' | 'err'; title: string; detail?: string };

type Burst =
  | { phase: 'working' }
  | { phase: 'ok'; name?: string; points?: number; delta?: number }
  | { phase: 'claim'; name?: string; title?: string }
  | { phase: 'err'; title: string; detail?: string };

type Draft =
  | {
      mode: 'accumulate';
      serial: string;
      amount: string;
      points: string;
      needsPoints: boolean;
    }
  | {
      mode: 'claim';
      serial: string;
      amount: string;
      benefit: string;
      needsPaymentAmount: boolean;
      needsBenefitAmount: boolean;
      promotionTitle?: string;
    };

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
        ? burst.delta != null && burst.delta !== 1
          ? `+${burst.delta} ondas`
          : '+1 onda'
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
  draft,
  currency,
  ondaValue,
  onChange,
  onCancel,
  onConfirm,
}: {
  draft: Draft;
  currency: string;
  ondaValue: number | null;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasOndaValue = ondaValue != null && ondaValue > 0;
  const precio = Number(parseMoneyInput(draft.amount));
  const preview =
    draft.mode === 'accumulate' &&
    hasOndaValue &&
    Number.isFinite(precio) &&
    precio > 0
      ? ondasFromPayment(precio, ondaValue)
      : null;

  let ready = false;
  if (draft.mode === 'accumulate') {
    ready = Boolean(parseMoneyInput(draft.amount));
  } else {
    ready = true;
    if (draft.needsPaymentAmount) {
      ready = Boolean(parseMoneyInput(draft.amount));
    }
    if (draft.needsBenefitAmount) {
      ready = ready && Boolean(parseMoneyInput(draft.benefit));
    }
  }

  return (
    <div
      className="onda-caja-amount"
      role="dialog"
      aria-labelledby="onda-caja-amount-title"
    >
      <form
        className="onda-caja-amount-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm();
        }}
      >
        <p className="onda-caja-amount-kicker">
          {draft.mode === 'accumulate' ? 'Acumular onda' : 'Reclamar premio'}
        </p>
        <h2 id="onda-caja-amount-title" className="font-display">
          {draft.mode === 'claim' && draft.needsBenefitAmount
            ? 'Valor del beneficio'
            : 'Valor de la cuenta'}
        </h2>
        {hasOndaValue ? (
          <p className="mb-2 text-xs text-[var(--onda-muted)]">
            Una onda cuesta {formatCop(ondaValue)}
          </p>
        ) : null}
        {draft.mode === 'claim' && draft.promotionTitle ? (
          <p className="mb-2 text-sm text-[var(--onda-ink)]">
            {draft.promotionTitle}
          </p>
        ) : null}

        {(draft.mode === 'accumulate' ||
          (draft.mode === 'claim' && draft.needsPaymentAmount)) && (
          <label className="onda-caja-amount-field">
            <span className="onda-caja-amount-prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9.]*"
              autoComplete="off"
              enterKeyHint="done"
              autoFocus
              value={formatMoneyInput(draft.amount)}
              onChange={(e) =>
                onChange({ amount: parseMoneyInput(e.target.value) } as Partial<Draft>)
              }
              aria-label="Valor de la cuenta"
            />
            <span className="onda-caja-amount-currency">{currency}</span>
          </label>
        )}

        {draft.mode === 'accumulate' && preview != null ? (
          <p className="mt-2 text-center text-sm text-[var(--onda-muted)]">
            {preview > 0
              ? `→ ${preview} onda${preview === 1 ? '' : 's'}`
              : '→ 0 ondas (venta registrada)'}
          </p>
        ) : null}

        {draft.mode === 'accumulate' && draft.needsPoints ? (
          <label className="mt-3 block text-left text-sm text-[var(--onda-muted)]">
            Ondas a acumular
            <input
              type="number"
              min={1}
              placeholder="1"
              className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
              value={draft.points}
              onChange={(e) =>
                onChange({ points: e.target.value } as Partial<Draft>)
              }
            />
            <span className="mt-1 block text-xs">
              Opcional. Si no pones nada, se acumula 1 onda.
            </span>
          </label>
        ) : null}

        {draft.mode === 'claim' && draft.needsBenefitAmount ? (
          <label className="onda-caja-amount-field mt-2">
            <span className="onda-caja-amount-prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9.]*"
              autoComplete="off"
              autoFocus={!draft.needsPaymentAmount}
              value={formatMoneyInput(draft.benefit)}
              onChange={(e) =>
                onChange({ benefit: parseMoneyInput(e.target.value) } as Partial<Draft>)
              }
              aria-label="Valor del beneficio"
            />
            <span className="onda-caja-amount-currency">{currency}</span>
          </label>
        ) : null}

        <button type="submit" className="onda-caja-amount-submit" disabled={!ready}>
          {draft.mode === 'accumulate' ? 'Acumular' : 'Confirmar canje'}
        </button>
        <button
          type="button"
          className="onda-caja-amount-cancel"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </form>
    </div>
  );
}

function AccumulateLinkTabs({
  storeId,
  serial,
  token,
  onLinked,
  onCancel,
  onManualAmount,
}: {
  storeId: string;
  serial: string;
  token?: string;
  onLinked: (tabLabel: string) => void;
  onCancel: () => void;
  onManualAmount: () => void;
}) {
  const [tabs, setTabs] = useState<PosTabDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const qs = useCallback(() => {
    const p = new URLSearchParams({ storeId });
    if (token) p.set('token', token);
    return p.toString();
  }, [storeId, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<PosTabDto[]>(
        `/pos/tabs?${qs()}&status=OPEN,CHECKOUT`
      );
      setTabs(rows.filter((t) => !t.passId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas');
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function linkTab(tabId: string, label: string) {
    setBusyId(tabId);
    setError('');
    try {
      await api(`/pos/tabs/${tabId}/link-pass?${qs()}`, {
        method: 'POST',
        body: JSON.stringify({ payload: serial }),
      });
      onLinked(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo asociar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="onda-caja-amount" role="dialog" aria-labelledby="onda-caja-link-title">
      <div className="onda-caja-amount-card space-y-3">
        <p className="onda-caja-amount-kicker">Cliente escaneado</p>
        <h2 id="onda-caja-link-title" className="font-display">
          Asociar a una cuenta
        </h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Elige una venta abierta sin cliente. Las ondas se acumulan al cobrar.
        </p>
        {loading ? (
          <SkeletonList rows={3} />
        ) : tabs.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--onda-muted)]">
            No hay cuentas pendientes de asociar.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  className="onda-card w-full p-3 text-left transition hover:border-[var(--onda-primary-500)]/40 disabled:opacity-60"
                  disabled={Boolean(busyId)}
                  onClick={() => void linkTab(tab.id, tab.label)}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-[var(--onda-ink)]">{tab.label}</span>
                    <span className="tabular-nums">{formatCop(tab.total)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--onda-muted)]">
                    {busyId === tab.id ? 'Asociando…' : 'Sin cliente · tocar para vincular'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
        <button type="button" className="onda-caja-amount-submit" onClick={onManualAmount}>
          Acumular por monto
        </button>
        <button type="button" className="onda-caja-amount-cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function parseSerial(raw: string) {
  return raw.trim();
}

export function CajaScanClient({
  token: tokenProp,
  storeId: storeIdProp,
  embedded = false,
  hideHeader = false,
  posEnabled: posEnabledProp,
  active = true,
}: {
  token?: string;
  /** Si no hay token (p. ej. merchant con Firebase), se obtiene vía POST /caja/link */
  storeId?: string;
  embedded?: boolean;
  hideHeader?: boolean;
  /** Si se conoce desde el merchant; si no, viene de /caja/session */
  posEnabled?: boolean;
  /** Cuando es false, detiene la cámara (p. ej. pane de solicitudes activo). */
  active?: boolean;
} = {}) {
  const [token, setToken] = useState(tokenProp);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);

  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [ondaValue, setOndaValue] = useState<number | null>(null);
  const [posEnabled, setPosEnabled] = useState(Boolean(posEnabledProp));
  const [forceAmountDraft, setForceAmountDraft] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<Flash | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const burstTimerRef = useRef<number>(0);
  const tokenQs =
    embedded && token ? `?token=${encodeURIComponent(token)}` : '';

  useEffect(() => {
    setToken(tokenProp);
  }, [tokenProp]);

  useEffect(() => {
    if (posEnabledProp != null) setPosEnabled(Boolean(posEnabledProp));
  }, [posEnabledProp]);

  useEffect(() => {
    if (tokenProp || !storeIdProp) return;
    let cancelled = false;
    void api<{ token: string }>('/caja/link', {
      method: 'POST',
      body: JSON.stringify({ storeId: storeIdProp }),
    })
      .then((link) => {
        if (!cancelled) setToken(link.token);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudo abrir el escaneo'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeIdProp, tokenProp]);

  useEffect(() => {
    if (!token || embedded) return;
    try {
      setApiAuthTokenGetter(async () => token);
    } catch {
      /* noop */
    }
  }, [token, embedded]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{
      storeId: string;
      storeName: string;
      currency?: string;
      ondaValue?: number | null;
      posEnabled?: boolean;
    }>(`/caja/session${embedded ? tokenQs : `?token=${token}`}`)
      .then((session) => {
        if (cancelled) return;
        setStoreId(session.storeId);
        setStoreName(session.storeName);
        if (session.currency) setCurrency(session.currency);
        setOndaValue(
          session.ondaValue != null && Number(session.ondaValue) > 0
            ? Number(session.ondaValue)
            : null
        );
        if (posEnabledProp == null) {
          setPosEnabled(Boolean(session.posEnabled));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Enlace de caja inválido');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, embedded, tokenQs]);

  useEffect(() => {
    if (!storeId || !active) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCamReady(false);
      return;
    }
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
            title: 'Sin cámara',
            detail: 'Permite el acceso a la cámara para escanear',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, active]);

  function clearBurst() {
    window.clearTimeout(burstTimerRef.current);
    setBurst(null);
    scanningRef.current = false;
  }

  function cancelDraft() {
    setDraft(null);
    setForceAmountDraft(false);
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

  async function resolveScan(
    serial: string,
    opts?: { paymentAmount?: number; points?: number; benefitAmount?: number }
  ) {
    setBurst({ phase: 'working' });
    try {
      const result = await api<{
        kind?: 'redeem' | 'accumulate' | 'accumulated' | 'claim';
        pass?: { user?: { name?: string }; points: number };
        delta?: number;
        promotion?: { title?: string; type?: string; value?: number | null };
        message?: string;
        needsPoints?: boolean;
        needsPaymentAmount?: boolean;
        needsBenefitAmount?: boolean;
        ondaValue?: number | null;
      }>(`/caja/scan${tokenQs}`, {
        method: 'POST',
        body: JSON.stringify({
          serialNumber: serial,
          ...(opts?.paymentAmount != null
            ? { paymentAmount: opts.paymentAmount }
            : {}),
          ...(opts?.points != null ? { points: opts.points } : {}),
          ...(opts?.benefitAmount != null
            ? { benefitAmount: opts.benefitAmount }
            : {}),
        }),
      });

      if (result.kind === 'claim') {
        setBurst(null);
        setDraft({
          mode: 'claim',
          serial,
          amount: '',
          benefit: '',
          needsPaymentAmount: Boolean(result.needsPaymentAmount),
          needsBenefitAmount: Boolean(result.needsBenefitAmount),
          promotionTitle: result.promotion?.title,
        });
        if (result.ondaValue != null) setOndaValue(Number(result.ondaValue));
        return;
      }

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
        setForceAmountDraft(false);
        setDraft({
          mode: 'accumulate',
          serial,
          amount: '',
          points: '',
          needsPoints: Boolean(result.needsPoints),
        });
        if (result.ondaValue != null) {
          setOndaValue(
            Number(result.ondaValue) > 0 ? Number(result.ondaValue) : null
          );
        }
        return;
      }
      showBurst(
        {
          phase: 'ok',
          name: result.pass?.user?.name,
          points: result.pass?.points,
          delta: result.delta,
        },
        2400
      );
    } catch (err) {
      showBurst(
        {
          phase: 'err',
          title: opts ? 'No se pudo completar' : 'No se pudo validar',
          detail: err instanceof Error ? err.message : 'Intenta de nuevo',
        },
        2200
      );
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    const serial = draft.serial;
    const precio = Number(parseMoneyInput(draft.amount));
    const paymentAmount =
      Number.isFinite(precio) && precio > 0 ? precio : undefined;

    if (draft.mode === 'accumulate') {
      const points = draft.needsPoints
        ? manualOndasOrDefault(draft.points)
        : undefined;
      setDraft(null);
      await resolveScan(serial, {
        paymentAmount,
        ...(points != null ? { points } : {}),
      });
      return;
    }

    const benefitRaw = Number(parseMoneyInput(draft.benefit));
    const benefitAmount =
      Number.isFinite(benefitRaw) && benefitRaw > 0 ? benefitRaw : undefined;
    setDraft(null);
    await resolveScan(serial, {
      paymentAmount: draft.needsPaymentAmount ? paymentAmount : undefined,
      benefitAmount: draft.needsBenefitAmount ? benefitAmount : undefined,
    });
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
      <SkeletonScreen
        label="Abriendo caja"
        className={embedded ? 'min-h-[12rem]' : undefined}
      />
    );
  }

  return (
    <div
      className={`onda-caja-shell is-scan-only${embedded ? ' is-embedded' : ''}`}
    >
      {!hideHeader ? (
        <header className="onda-caja-top">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
              Caja
            </p>
            <h1 className="font-display text-lg font-bold">{storeName}</h1>
            {ondaValue != null ? (
              <p className="text-xs text-[var(--onda-muted)]">
                Una onda cuesta {formatCop(ondaValue)}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className="onda-caja-body">
        <section className="onda-caja-scan" aria-label="Escanear QR">
          <video
            ref={videoRef}
            muted
            playsInline
            className="bg-[var(--onda-ink)]"
          />
          <div className="onda-caja-scan-frame" />
          {!camReady && !flash ? (
            <div className="onda-caja-flash flex justify-center">
              <Skeleton className="h-3 w-28" />
            </div>
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
      {draft?.mode === 'accumulate' && posEnabled && !forceAmountDraft ? (
        <AccumulateLinkTabs
          storeId={storeId}
          serial={draft.serial}
          token={token}
          onCancel={cancelDraft}
          onManualAmount={() => setForceAmountDraft(true)}
          onLinked={(tabLabel) => {
            setDraft(null);
            setForceAmountDraft(false);
            scanningRef.current = false;
            setFlash({
              tone: 'ok',
              title: 'Cliente asociado',
              detail: `${tabLabel} · las ondas se acumulan al cobrar`,
            });
            window.setTimeout(() => setFlash(null), 2400);
          }}
        />
      ) : draft ? (
        <CajaAmountSheet
          draft={draft}
          currency={currency}
          ondaValue={ondaValue}
          onChange={(patch) =>
            setDraft((prev) => (prev ? ({ ...prev, ...patch } as Draft) : prev))
          }
          onCancel={cancelDraft}
          onConfirm={() => void confirmDraft()}
        />
      ) : null}
      {burst ? <CajaBurst burst={burst} onDismiss={clearBurst} /> : null}
    </div>
  );
}
