'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, OndaLogo, PassPreview } from '@onda/shared-ui';
import {
  getDemoDeviceId,
  type DemoSpaDesign,
  type DemoSpaState,
} from '../../lib/demo-device';

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function OndaSpaProxyPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [state, setState] = useState<DemoSpaState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deviceId = getDemoDeviceId();
        const res = await api<DemoSpaState>('/demo/onda-spa/activate', {
          method: 'POST',
          body: JSON.stringify({ deviceId }),
        });
        if (cancelled) return;
        setState(res);
        setStatus('ready');

        // Prefer auto-open wallet when possible
        const preferApple = isIos();
        const url = preferApple ? res.appleUrl : res.googleUrl || res.appleUrl;
        if (url && !res.stub && !url.includes('/stub/')) {
          window.setTimeout(() => {
            window.location.href = url;
          }, 600);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'No se pudo activar el demo');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const design: DemoSpaDesign | null = useMemo(() => state?.design ?? null, [state]);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--onda-bg)] px-5 py-8 text-[var(--onda-ink)]">
      <div className="mx-auto w-full max-w-md">
        <OndaLogo />
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">
          Tu tarjeta Onda Spa
        </h1>
        <p className="mt-2 text-[var(--onda-muted)]">
          {status === 'loading'
            ? 'Activando tu beneficio…'
            : status === 'ready'
              ? 'Lista para guardar en Wallet y empezar a acumular.'
              : 'No pudimos activar la demo. Intenta de nuevo.'}
        </p>

        {status === 'loading' ? (
          <div className="mt-10 h-40 animate-pulse rounded-[1.5rem] bg-[var(--onda-card)]" />
        ) : null}

        {status === 'error' ? (
          <div className="mt-8 rounded-2xl border border-[var(--onda-danger)]/30 bg-white p-5 text-sm text-[var(--onda-danger)]">
            {error}
          </div>
        ) : null}

        {status === 'ready' && state && design ? (
          <div className="mt-8 space-y-5">
            <PassPreview
              backgroundColor={design.backgroundColor}
              foregroundColor={design.foregroundColor}
              labelColor={design.labelColor}
              title={design.title}
              subtitle={design.subtitle}
              description={design.description}
              logoUrl={design.logoUrl}
              points={state.points}
              maxStamps={state.maxStamps}
              memberName={state.memberName}
              milestoneStamps={[state.maxStamps]}
            />

            <div className="flex flex-col gap-3">
              {state.appleUrl ? (
                <a
                  href={state.appleUrl}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--onda-ink)] px-5 py-3.5 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  Guardar en Apple Wallet
                </a>
              ) : null}
              {state.googleUrl ? (
                <a
                  href={state.googleUrl}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-5 py-3.5 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  Guardar en Google Wallet
                </a>
              ) : null}
              {state.stub ? (
                <p className="text-center text-xs text-[var(--onda-muted)]">
                  Demo local: el pase está listo. Con WALLET_API_KEY se emite el pase real.
                </p>
              ) : null}
            </div>

            <a
              href="/#demo"
              className="block text-center text-sm font-medium text-[var(--onda-primary-500)]"
            >
              Seguir probando la demo →
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
