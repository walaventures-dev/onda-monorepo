'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CajaOperationsPanel,
  PasswordInput,
  Button,
  api,
  setApiAuthTokenGetter,
  SkeletonScreen,
} from '@onda/shared-ui';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getMerchantAuth } from '../lib/firebase';
import { loadDefaultStoreId, useCajaAuth } from '../lib/useCajaAuth';

type CajaSession = {
  storeId: string;
  storeName: string;
  posEnabled?: boolean;
  ondaValue?: number | null;
};

/** App única de caja (kiosk): acumular + cuentas abiertas / asociar. */
export function CajaKioskClient({ token }: { token: string }) {
  const [session, setSession] = useState<CajaSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setApiAuthTokenGetter(async () => token);
    let cancelled = false;
    void api<CajaSession>(`/caja/session?token=${encodeURIComponent(token)}`)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Enlace de caja inválido',
          );
        }
      });
    return () => {
      cancelled = true;
      setApiAuthTokenGetter(null);
    };
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-[var(--onda-danger)]">{error}</p>
        <p className="text-xs text-[var(--onda-muted)]">
          Genera un enlace nuevo con «Abrir caja» en el panel del comercio.
        </p>
      </main>
    );
  }

  if (!session) {
    return <SkeletonScreen label="Abriendo caja" />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CajaOperationsPanel
        storeId={session.storeId}
        storeName={session.storeName}
        posEnabled={Boolean(session.posEnabled)}
        ondaValue={session.ondaValue}
        token={token}
      />
    </main>
  );
}

export function CajaLoginClient() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(
        getMerchantAuth(),
        email.trim(),
        password,
      );
      router.replace('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  }

  if (!firebaseEnabled) {
    return (
      <p className="p-6 text-center text-sm text-[var(--onda-muted)]">
        Usa «Abrir caja» en el panel del comercio para el enlace kiosk.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-6"
    >
      <h1 className="font-display text-center text-2xl font-semibold">
        Caja Onda
      </h1>
      <label className="block space-y-1 text-sm">
        <span>Email</span>
        <input
          className="onda-input w-full rounded-xl px-3 py-2 text-[var(--onda-ink)]"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Contraseña</span>
        <PasswordInput
          className="rounded-xl"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit">Entrar</Button>
    </form>
  );
}

/** Hub con login Firebase: misma app unificada (útil en desarrollo). */
export function CajaHubClient() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [storeId, setStoreId] = useState('');
  const [posEnabled, setPosEnabled] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ondaValue, setOndaValue] = useState<number | null>(null);
  const [cajaToken, setCajaToken] = useState<string | undefined>();

  useEffect(() => {
    if (!ready) return;
    if (firebaseEnabled && !user) {
      router.replace('/login');
      return;
    }
    void (async () => {
      const id = await loadDefaultStoreId();
      if (!id) return;
      setStoreId(id);
      try {
        const link = await api<{ token: string; url: string }>('/caja/link', {
          method: 'POST',
          body: JSON.stringify({ storeId: id }),
        });
        setCajaToken(link.token);
        setApiAuthTokenGetter(async () => link.token);
        const session = await api<CajaSession>(
          `/caja/session?token=${encodeURIComponent(link.token)}`,
        );
        setPosEnabled(Boolean(session.posEnabled));
        setStoreName(session.storeName);
        setOndaValue(
          session.ondaValue != null && Number(session.ondaValue) > 0
            ? Number(session.ondaValue)
            : null,
        );
      } catch {
        setPosEnabled(false);
      }
    })();
  }, [ready, user, firebaseEnabled, router]);

  if (!storeId) {
    return <SkeletonScreen label="Cargando sede" />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CajaOperationsPanel
        storeId={storeId}
        storeName={storeName || undefined}
        posEnabled={posEnabled}
        ondaValue={ondaValue}
        token={cajaToken}
      />
    </main>
  );
}
