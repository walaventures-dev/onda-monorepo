'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, PassPreview } from '@onda/shared-ui';
import { fadeUp } from '../lib/motion';
import {
  getDemoDeviceId,
  hasWelcomePulseDone,
  markWelcomePulseDone,
  type DemoSpaDesign,
  type DemoSpaState,
} from '../lib/demo-device';
import { HabladorStand } from './mocks/HabladorStand';

type InfoResponse = {
  name: string;
  maxStamps: number;
  design: DemoSpaDesign | null;
  promo: DemoSpaState['promo'];
};

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{
            left: `${6 + ((i * 19) % 88)}%`,
            top: `${12 + ((i * 23) % 55)}%`,
            background: i % 3 === 0 ? '#DDF24E' : i % 3 === 1 ? '#3DB9E8' : '#052DDE',
            animation: `onda-confetti 1.15s ease-out ${i * 0.03}s both`,
          }}
        />
      ))}
    </div>
  );
}

export function DemoSection() {
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [state, setState] = useState<DemoSpaState | null>(null);
  const [displayPoints, setDisplayPoints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flashStamp, setFlashStamp] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');

  const design = state?.design || info?.design;
  const maxStamps = state?.maxStamps || info?.maxStamps || 10;
  const active = Boolean(state?.passId);

  useEffect(() => {
    setProxyUrl(`${window.location.origin}/d/onda-spa`);
  }, []);

  const qrSrc = useMemo(() => {
    if (!proxyUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(proxyUrl)}`;
  }, [proxyUrl]);

  const refreshState = useCallback(async () => {
    const deviceId = getDemoDeviceId();
    try {
      const res = await api<DemoSpaState & { active: boolean }>(
        `/demo/onda-spa/state/${encodeURIComponent(deviceId)}`,
      );
      if (res.active) {
        setState(res);
        setDisplayPoints(res.points);
        return res;
      }
      setState(null);
      return null;
    } catch {
      return null;
    }
  }, []);

  const runWelcomePulse = useCallback(
    async (fromPoints: number) => {
      if (hasWelcomePulseDone()) return;
      setFlashStamp(fromPoints + 1);
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 450));
        const deviceId = getDemoDeviceId();
        const res = await api<DemoSpaState>('/demo/onda-spa/pulse', {
          method: 'POST',
          body: JSON.stringify({ deviceId }),
        });
        setState(res);
        setDisplayPoints(res.points);
        markWelcomePulseDone();
        setBanner('¡+1 onda! Ya vas por el premio.');
        window.setTimeout(() => setBanner(null), 2200);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo acumular');
      } finally {
        setBusy(false);
        window.setTimeout(() => setFlashStamp(null), 700);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await api<InfoResponse>('/demo/onda-spa');
        if (cancelled) return;
        setInfo(meta);
        const current = await refreshState();
        if (cancelled || !current) return;
        if (current.needsWelcomePulse && !hasWelcomePulseDone()) {
          setDisplayPoints(current.points);
          window.setTimeout(() => {
            void runWelcomePulse(current.points);
          }, 700);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Demo no disponible');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshState, runWelcomePulse]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshState().then((current) => {
          if (current?.needsWelcomePulse && !hasWelcomePulseDone()) {
            setDisplayPoints(current.points);
            void runWelcomePulse(current.points);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshState, runWelcomePulse]);

  async function activate() {
    setBusy(true);
    setError('');
    try {
      const deviceId = getDemoDeviceId();
      const res = await api<DemoSpaState>('/demo/onda-spa/activate', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      setState(res);
      setDisplayPoints(res.points);
      if (res.needsWelcomePulse && !hasWelcomePulseDone()) {
        setDisplayPoints(res.points);
        window.setTimeout(() => {
          void runWelcomePulse(res.points);
        }, 500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar');
    } finally {
      setBusy(false);
    }
  }

  async function darOnda() {
    if (!active || busy) return;
    setBusy(true);
    setError('');
    setBanner(null);
    try {
      const deviceId = getDemoDeviceId();
      const before = displayPoints;
      const res = await api<DemoSpaState>('/demo/onda-spa/pulse', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      setState(res);

      if (res.action === 'accumulated') {
        setFlashStamp(before + 1);
        setDisplayPoints(res.points);
        setBanner(
          res.points >= maxStamps
            ? '¡Completaste las 10! Canjea tu 30% en masajes.'
            : `¡+1 onda! Te faltan ${Math.max(0, maxStamps - res.points)} para el 30%.`,
        );
      } else if (res.action === 'redeemed') {
        setDisplayPoints(res.points);
        setBanner(res.notification || '¡Listo! 30% en tu próxima sesión de masajes.');
      } else if (res.action === 'already_redeemed') {
        setDisplayPoints(res.points);
        setBanner('Ya canjeaste tu premio. Escanea de nuevo en tu próxima visita.');
      }

      window.setTimeout(() => setFlashStamp(null), 800);
      window.setTimeout(() => setBanner(null), 3200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar la onda');
    } finally {
      setBusy(false);
    }
  }

  const canDarOnda =
    active &&
    !busy &&
    state &&
    !state.redeemedThisCycle;

  const primaryLabel = !active
    ? 'Activar mi tarjeta'
    : state?.redeemedThisCycle
      ? 'Premio canjeado'
      : state && state.points >= maxStamps
        ? 'Canjear 30% en masajes'
        : 'Dar una onda';

  const helperText = !active
    ? 'Toca el hablador, escanea el QR o activa aquí. En segundos tienes tu tarjeta lista.'
    : state?.redeemedThisCycle
      ? 'Así de fácil es hacerlos volver — en el local y en Wallet.'
      : state?.appleUrl || state?.googleUrl
        ? 'Guárdala en Wallet y sigue acumulando. El premio se actualiza al instante.'
        : 'Sigue acumulando ondas. Al completarlas, canjeas el 30% en masajes.';

  return (
    <section id="demo" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...fadeUp} className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]">
          Pruébalo en vivo
        </h2>
        <p className="mt-3 text-lg text-[var(--onda-muted)]">
          Activa la tarjeta de <strong className="text-[var(--onda-ink)]">Onda Spa</strong>,
          acumula ondas y canjea un{' '}
          <strong className="text-[var(--onda-ink)]">30% en masajes</strong>. Así
          vive tu cliente la experiencia — aquí y en Wallet.
        </p>
      </motion.div>

      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div {...fadeUp} className="flex flex-col items-center gap-3">
          <HabladorStand
            qrSrc={qrSrc}
            proxyUrl={proxyUrl}
            busy={busy}
            onTap={active ? undefined : () => void activate()}
          />
          {!active ? (
            <p className="max-w-[14rem] text-center text-xs text-[var(--onda-muted)]">
              Como en el local: acerca el celular o escanea.
            </p>
          ) : null}
        </motion.div>

        <motion.div {...fadeUp} className="relative mx-auto w-full max-w-sm">
          <div className="relative">
            {design ? (
              <div className="relative">
                <PassPreview
                  backgroundColor={design.backgroundColor}
                  foregroundColor={design.foregroundColor}
                  labelColor={design.labelColor}
                  title={design.title}
                  subtitle={design.subtitle}
                  description={design.description}
                  logoUrl={design.logoUrl}
                  points={displayPoints}
                  maxStamps={maxStamps}
                  memberName={state?.memberName || (active ? 'Visitante Onda' : undefined)}
                  milestoneStamps={[maxStamps]}
                  onAddToWallet={
                    state?.appleUrl || state?.googleUrl
                      ? () => {
                          const preferApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          const url = preferApple
                            ? state.appleUrl || state.googleUrl
                            : state.googleUrl || state.appleUrl;
                          if (url) window.open(url, '_blank');
                        }
                      : undefined
                  }
                  walletBusy={busy}
                  walletLabel="Guardar en Wallet"
                />
                <AnimatePresence>
                  {flashStamp != null ? (
                    <motion.div
                      key={flashStamp}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1.15, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <span className="rounded-full bg-[var(--onda-lime)] px-4 py-2 text-sm font-bold text-[var(--onda-ink)] shadow-lg">
                        +1 onda
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {banner && state?.action === 'redeemed' ? <ConfettiBurst /> : null}
              </div>
            ) : (
              <div className="h-56 animate-pulse rounded-[1.5rem] bg-[var(--onda-card)]" />
            )}
          </div>

          <AnimatePresence>
            {banner ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-2xl bg-[var(--onda-primary-500)] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
              >
                {banner}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? (
            <p className="mt-3 text-center text-sm text-[var(--onda-danger)]">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (!active) void activate();
              else void darOnda();
            }}
            disabled={busy || (active && !canDarOnda)}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-5 py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {primaryLabel}
          </button>

          <p className="mt-3 text-center text-xs text-[var(--onda-muted)]">{helperText}</p>
        </motion.div>
      </div>
    </section>
  );
}
