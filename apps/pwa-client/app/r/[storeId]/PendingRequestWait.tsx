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
};

export function PendingRequestWait({
  request,
  passId,
  session,
  onResolved,
}: {
  request: PendingRequestDto;
  passId: string;
  session: CustomerSession;
  onResolved: (status: 'CONFIRMED' | 'REJECTED' | 'EXPIRED') => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000))
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="onda-pwa-sub">Muéstrale este código a caja</p>
      <p className="font-display text-5xl font-bold tracking-[0.2em] text-[var(--onda-violet)]">
        {request.devCode || request.code}
      </p>
      <p className="text-sm text-[var(--onda-muted)]">Expira en {mm}:{ss}</p>
    </div>
  );
}
