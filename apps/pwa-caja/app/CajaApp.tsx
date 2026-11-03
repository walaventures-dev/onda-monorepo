'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, api } from '@onda/shared-ui';
import { clearCajaToken } from '../lib/caja-token';
import { writePosToken } from '../lib/pos-session';

const PIN_LENGTH = 4;

function PinDots({ length }: { length: number }) {
  return (
    <div className="flex justify-center gap-3" aria-label="PIN">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition-colors ${
            i < length
              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-500)]'
              : 'border-[var(--onda-muted)] bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Login de la PWA caja con ámbito de negocio (URL /[store]/login):
 * usuario + PIN de 4 dígitos con teclado numérico. La sesión queda guardada
 * en el dispositivo hasta que el usuario la cierre.
 */
export function CajaLoginClient({ store }: { store: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [brand, setBrand] = useState<{
    storeId?: string;
    logoUrl?: string | null;
    color?: string;
    foreground?: string;
  } | null>(null);
  const [storeError, setStoreError] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  /** Marca del negocio (ámbito de la URL) para pintar el login. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storeInfo = await api<{
          id: string;
          name: string;
          passDesign?: {
            logoUrl?: string | null;
            backgroundColor?: string | null;
            foregroundColor?: string | null;
          } | null;
        }>(`/stores/${encodeURIComponent(store)}`);
        if (cancelled) return;
        const design = storeInfo.passDesign;
        setBrand({
          storeId: storeInfo.id,
          logoUrl: design?.logoUrl,
          color: design?.backgroundColor || undefined,
          foreground: design?.foregroundColor || undefined,
        });
      } catch {
        if (!cancelled) setStoreError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function submit(user: string, code: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ token: string }>('/pos/users/login', {
        method: 'POST',
        body: JSON.stringify({ store, username: user.trim(), pin: code }),
      });
      // El enlace kiosk ya no hace falta: la sesión es del usuario.
      clearCajaToken();
      writePosToken(res.token);
      router.replace(`/${store}/`);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('Negocio')
          ? err.message
          : 'Usuario o PIN incorrectos',
      );
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function pressDigit(d: string) {
    if (busy) return;
    setError('');
    const user = username.trim();
    if (!user) {
      usernameRef.current?.focus();
      return;
    }
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(user, next);
  }

  function eraseDigit() {
    setPin((p) => p.slice(0, -1));
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  if (storeError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-xl font-semibold text-[var(--onda-ink)]">
          Negocio no encontrado
        </h1>
        <p className="text-sm text-[var(--onda-muted)]">
          Revisa el enlace de tu comercio (apps/pwa-caja/[id]/) o pide al
          administrador que te lo comparta de nuevo.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-4">
        {brand?.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt=""
            className="mx-auto mb-1 h-16 rounded-2xl object-contain"
          />
        ) : null}
        <h1 className="font-display text-center text-2xl font-semibold">
          Caja
        </h1>
        <label className="block space-y-1 text-sm">
          <span>Usuario</span>
          <input
            ref={usernameRef}
            className="onda-input w-full rounded-xl px-3 py-2 text-[var(--onda-ink)]"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') pressDigit('');
            }}
          />
        </label>
        <PinDots length={pin.length} />
        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pressDigit(k)}
              className="h-14 rounded-2xl bg-[var(--onda-surface-2,#f1f5f9)] text-2xl font-semibold text-[var(--onda-ink)] active:scale-95"
              style={{ background: 'var(--onda-primary-100, #f1f5f9)' }}
            >
              {k}
            </button>
          ))}
          <span />
          <button
            type="button"
            onClick={() => pressDigit('0')}
            className="h-14 rounded-2xl text-2xl font-semibold text-[var(--onda-ink)] active:scale-95"
            style={{ background: 'var(--onda-primary-100, #f1f5f9)' }}
          >
            0
          </button>
          <button
            type="button"
            onClick={eraseDigit}
            aria-label="Borrar"
            className="h-14 rounded-2xl text-lg font-medium text-[var(--onda-muted)] active:scale-95"
            style={{ background: 'var(--onda-primary-100, #f1f5f9)' }}
          >
            ⌫
          </button>
        </div>
        <Button
          type="button"
          size="lg"
          fullWidth
          isDisabled={busy}
          onClick={() => {
            const user = username.trim();
            if (user && pin.length === PIN_LENGTH) void submit(user, pin);
          }}
          style={{
            background: brand?.color || 'var(--onda-primary-500)',
            color: brand?.foreground || '#FFFFFF',
            opacity: busy ? 0.7 : 1,
          }}
        >
          Entrar
        </Button>
      </div>
      <footer className="flex justify-center pt-6">
        <img
          src="/brand/onda-wordmark.png"
          alt="Onda"
          className="h-6 opacity-60"
        />
      </footer>
    </main>
  );
}
