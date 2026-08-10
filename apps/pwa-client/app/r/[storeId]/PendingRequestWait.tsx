'use client';

import { useEffect, useState } from 'react';
import { api } from '@onda/shared-ui';
import type { CustomerSession } from '../../../lib/session';

export type PendingRequestDto = {
  id: string;
  passId: string;
  code: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  expiresAt: string;
  devCode?: string;
  type?: 'ACCUMULATE' | 'CLAIM';
  promotionTitle?: string;
};

export function PendingRequestWait({
  request,
  passId,
  session,
  storeName,
  onResolved,
  onCancel,
}: {
  request: PendingRequestDto;
  passId: string;
  session: CustomerSession;
  storeName: string;
  onResolved: (status: 'CONFIRMED' | 'REJECTED' | 'EXPIRED') => void;
  onCancel?: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000))
  );
  // Duración total capturada una sola vez al montar, solo para dibujar el anillo de progreso.
  const [totalSeconds] = useState(() =>
    Math.max(1, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    let cancelled = false;

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        // /mine devuelve la solicitud más reciente sin filtrar por status, así el
        // front puede distinguir CONFIRMED de REJECTED una vez deja de estar PENDING.
        const current = await api<PendingRequestDto | null>(
          `/pending-requests/mine?passId=${passId}`,
          { headers: { Authorization: `Bearer ${session.token}` } }
        );
        if (cancelled) return;
        if (current && current.id === request.id && current.status !== 'PENDING') {
          onResolved(current.status === 'CONFIRMED' ? 'CONFIRMED' : 'REJECTED');
        }
      } catch {
        /* red intermitente: se reintenta en el próximo tick */
      }
    }, 3000);

    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          onResolved('EXPIRED');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [passId, request.id, session.token, onResolved]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const code = request.devCode || request.code;
  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - secondsLeft / totalSeconds);
  const isClaim = request.type === 'CLAIM';
  const eyebrowColor = isClaim ? 'rgba(26,27,46,0.65)' : 'rgba(255,255,255,0.85)';
  const subtextColor = isClaim ? 'var(--onda-muted)' : 'rgba(255,255,255,0.7)';

  return (
    <div
      className={`-mx-5 -mb-2 flex flex-1 flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.75rem+env(safe-area-inset-top,0px))] ${isClaim ? 'text-[var(--onda-ink)]' : 'text-white'}`}
      style={{ backgroundColor: isClaim ? '#FFFDF3' : 'var(--onda-violet)' }}
    >
      <div className="flex items-center justify-between">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>←</span> Cancelar
        </button>
        <div className="flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase">
          <span aria-hidden>✺</span> {storeName}
        </div>
      </div>

      <div className="mt-16">
        <p className="onda-pwa-label" style={{ color: eyebrowColor }}>
          Muéstrale esto a caja
        </p>
        <h2
          className="text-4xl font-extrabold tracking-tight mt-2 leading-none"
          style={{ color: isClaim ? 'var(--onda-ink)' : '#fff' }}
        >
          {isClaim ? (
            <>
              Reclamemos
              <br />
              tu premio.
            </>
          ) : (
            <>
              Sumemos
              <br />
              tu onda.
            </>
          )}
        </h2>
        <p className="text-sm mt-4" style={{ color: subtextColor }}>
          {isClaim
            ? request.promotionTitle
              ? `${request.promotionTitle} — la persona en caja lo confirmará.`
              : 'La persona en caja lo confirmará.'
            : 'La persona en caja confirmará tu compra.'}
        </p>
      </div>

      <div className="onda-card mt-7 flex flex-col items-center gap-6 px-5 py-8 text-center">
        <p className="onda-pwa-label">Código de confirmación</p>
        <p className="font-display flex gap-3 text-4xl font-bold tracking-[0.05em] text-[var(--onda-violet)] sm:gap-4 sm:text-5xl">
          {code.split('').map((digit, i) => (
            <span key={i}>{digit}</span>
          ))}
        </p>
        <div className="relative flex h-28 w-28 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke="var(--onda-violet-soft)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke="var(--onda-bridge)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <span className="text-base font-bold text-[var(--onda-ink)]">
            {mm}:{ss}
          </span>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: isClaim ? 'var(--onda-violet)' : '#fff' }}
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold">Esperando confirmación</p>
          <p className="text-xs" style={{ color: subtextColor }}>
            Esta pantalla se actualiza sola
          </p>
        </div>
      </div>
    </div>
  );
}
