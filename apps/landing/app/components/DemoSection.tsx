'use client';

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type PanInfo,
} from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@onda/shared-ui';
import { fadeUp } from '../lib/motion';
import {
  getDemoDeviceId,
  hasWelcomePulseDone,
  markWelcomePulseDone,
  type DemoSpaDesign,
  type DemoSpaState,
} from '../lib/demo-device';
import { HabladorStand } from './mocks/HabladorStand';
import {
  IPhonePreview,
  LockScreen,
  WalletPassCard,
  WalletScreen,
} from './mocks/IPhonePreview';

type InfoResponse = {
  name: string;
  maxStamps: number;
  design: DemoSpaDesign | null;
  promo: DemoSpaState['promo'];
};

type PhoneScreen = 'lock' | 'wallet';

const NFC_THRESHOLD_PX = 140;

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

function centersDistance(a: DOMRect, b: DOMRect) {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
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
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreen>('lock');
  const [dragging, setDragging] = useState(false);
  const [nfcPulse, setNfcPulse] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const habladorRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const activatingRef = useRef(false);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const design = state?.design || info?.design;
  const maxStamps = state?.maxStamps || info?.maxStamps || 10;
  const active = Boolean(state?.passId);

  useEffect(() => {
    setProxyUrl(`${window.location.origin}/d/onda-spa`);
  }, []);

  // Si ya hay pase activo (reload / sesión previa), mostrar wallet
  useEffect(() => {
    if (active) setPhoneScreen('wallet');
  }, [active]);

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

  const runWelcomePulse = useCallback(async (fromPoints: number) => {
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
  }, []);

  const springHome = useCallback(async () => {
    await Promise.all([
      animate(dragX, 0, { type: 'spring', stiffness: 280, damping: 26, mass: 0.9 }),
      animate(dragY, 0, { type: 'spring', stiffness: 280, damping: 26, mass: 0.9 }),
    ]);
  }, [dragX, dragY]);

  const activate = useCallback(
    async (fromProximity = false) => {
      if (activatingRef.current || busy) return;
      activatingRef.current = true;
      setBusy(true);
      setError('');
      if (fromProximity) {
        setNfcPulse(true);
        window.setTimeout(() => setNfcPulse(false), 700);
      }
      try {
        const deviceId = getDemoDeviceId();
        const res = await api<DemoSpaState>('/demo/onda-spa/activate', {
          method: 'POST',
          body: JSON.stringify({ deviceId }),
        });
        setState(res);
        setDisplayPoints(res.points);
        setPhoneScreen('wallet');
        if (!fromProximity) {
          void springHome();
        }
        if (res.needsWelcomePulse && !hasWelcomePulseDone()) {
          setDisplayPoints(res.points);
          window.setTimeout(() => {
            void runWelcomePulse(res.points);
          }, 550);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo activar');
        activatingRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [busy, runWelcomePulse, springHome],
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
        setPhoneScreen('wallet');
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

  const checkProximityAndActivate = useCallback(() => {
    if (active || activatingRef.current || busy) return false;
    const hablador = habladorRef.current;
    const phone = phoneRef.current;
    if (!hablador || !phone) return false;
    const dist = centersDistance(hablador.getBoundingClientRect(), phone.getBoundingClientRect());
    if (dist <= NFC_THRESHOLD_PX) {
      void activate(true);
      return true;
    }
    return false;
  }, [active, busy, activate]);

  function onPhoneDrag() {
    checkProximityAndActivate();
  }

  function onPhoneDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) {
    setDragging(false);
    if (!(active || activatingRef.current)) {
      checkProximityAndActivate();
    }
    // Siempre vuelve a la posición inicial con spring
    void springHome();
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

  const canDarOnda = active && !busy && state && !state.redeemedThisCycle;

  const primaryLabel = !active
    ? 'Activar mi tarjeta'
    : state?.redeemedThisCycle
      ? 'Premio canjeado'
      : state && state.points >= maxStamps
        ? 'Canjear 30% en masajes'
        : 'Dar una onda';

  const helperText = !active
    ? 'Arrastra el celular hacia el hablador — como si lo acercaras en el local.'
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

      <motion.div {...fadeUp} className="relative mt-10 w-full md:mt-12">
        <div
          ref={sceneRef}
          className="relative overflow-hidden rounded-[1.75rem]"
        >
          <Image
            src="/product/spa-reception.png"
            alt="Recepción de spa con hablador Onda y pase en Wallet"
            width={1024}
            height={768}
            className="aspect-[16/10] h-auto w-full object-cover object-[center_55%] sm:aspect-[21/10] sm:object-[center_48%]"
            sizes="(max-width: 1152px) 100vw, 1152px"
            priority={false}
            draggable={false}
          />

          {/* Hablador centrado */}
          <div
            ref={habladorRef}
            className={`absolute bottom-[11%] left-1/2 z-10 w-[36%] max-w-[260px] min-w-[120px] -translate-x-1/2 transition sm:bottom-[13%] sm:w-[28%] ${
              nfcPulse ? 'scale-[1.04]' : ''
            }`}
          >
            <div
              className="origin-bottom isolate opacity-100"
              style={{ transform: 'perspective(700px) rotateX(3deg) scale(0.92)' }}
            >
              <div
                className={`rounded-[1.65rem] transition ${
                  nfcPulse ? 'ring-4 ring-[var(--onda-lime)]/80 ring-offset-2 ring-offset-transparent' : ''
                }`}
              >
                <HabladorStand
                  qrSrc={qrSrc}
                  proxyUrl={proxyUrl}
                  busy={busy}
                  onTap={active ? undefined : () => void activate(false)}
                  className="!mx-0 !max-w-none"
                />
              </div>
            </div>
          </div>

          {/* iPhone arrastrable */}
          <motion.div
            ref={phoneRef}
            style={{ x: dragX, y: dragY }}
            drag
            dragConstraints={sceneRef}
            dragElastic={0.12}
            dragMomentum={false}
            onDragStart={() => setDragging(true)}
            onDrag={onPhoneDrag}
            onDragEnd={onPhoneDragEnd}
            whileDrag={{ scale: 1.02, zIndex: 40 }}
            className={`absolute bottom-[4%] right-[3%] z-20 w-[20%] max-w-[140px] min-w-[96px] touch-none sm:bottom-[5%] sm:right-[5%] sm:w-[18%] sm:max-w-[155px] md:right-[6%] md:w-[16%] md:max-w-[168px] ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            aria-label="Arrastra el celular hacia el hablador para activar"
          >
            <IPhonePreview className="pointer-events-none !mx-0 !max-w-none">
              <AnimatePresence mode="wait" initial={false}>
                {phoneScreen === 'lock' ? (
                  <motion.div
                    key="lock"
                    className="h-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LockScreen />
                  </motion.div>
                ) : (
                  <motion.div
                    key="wallet"
                    className="h-full"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <WalletScreen>
                      {design ? (
                        <div className="relative">
                          <WalletPassCard
                            backgroundColor={design.backgroundColor}
                            foregroundColor={design.foregroundColor}
                            title={design.title}
                            subtitle={design.subtitle}
                            logoUrl={design.logoUrl}
                            stripImageUrl={design.stripImageUrl}
                            points={displayPoints}
                            maxStamps={maxStamps}
                            memberName={
                              state?.memberName || (active ? 'Visitante Onda' : undefined)
                            }
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
                                <span className="rounded-full bg-[var(--onda-lime)] px-3 py-1.5 text-xs font-bold text-[var(--onda-ink)]">
                                  +1 onda
                                </span>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                          {banner && state?.action === 'redeemed' ? <ConfettiBurst /> : null}
                        </div>
                      ) : (
                        <div className="h-36 animate-pulse rounded-xl bg-white/10" />
                      )}
                    </WalletScreen>
                  </motion.div>
                )}
              </AnimatePresence>
            </IPhonePreview>
          </motion.div>
        </div>
      </motion.div>

      <div className="mx-auto mt-8 max-w-md">
        {!active ? (
          <p className="text-center text-xs text-[var(--onda-muted)]">
            Arrastra el celular hacia el hablador — o tócalo / activa aquí.
          </p>
        ) : null}

        <AnimatePresence>
          {banner ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl bg-[var(--onda-primary-500)] px-4 py-3 text-center text-sm font-semibold text-white"
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
            if (!active) void activate(false);
            else void darOnda();
          }}
          disabled={busy || (active && !canDarOnda)}
          className="mt-5 flex w-full items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-5 py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {primaryLabel}
        </button>

        <p className="mt-3 text-center text-xs text-[var(--onda-muted)]">{helperText}</p>
      </div>
    </section>
  );
}
