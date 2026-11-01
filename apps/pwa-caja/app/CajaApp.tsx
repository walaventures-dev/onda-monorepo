'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PasswordInput,
  Button,
  api,
  setApiAuthTokenGetter,
  SkeletonScreen,
} from '@onda/shared-ui';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getMerchantAuth, isMerchantFirebaseConfigured } from '../lib/firebase';
import { useCajaAuth } from '../lib/useCajaAuth';

type CajaSession = {
  storeId: string;
  storeName: string;
  posEnabled?: boolean;
  ondaValue?: number | null;
};

const CAJA_TOKEN_KEY = 'onda-caja-token';

export function readCajaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CAJA_TOKEN_KEY) || '';
}

export function writeCajaToken(token: string) {
  localStorage.setItem(CAJA_TOKEN_KEY, token);
}

export function clearCajaToken() {
  localStorage.removeItem(CAJA_TOKEN_KEY);
}

export function CajaLoginClient() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [brand, setBrand] = useState<{
    logoUrl?: string | null;
    color?: string;
    foreground?: string;
  } | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  /** Si la caja ya fue asociada, recupera la marca del negocio para pintar el login. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = readCajaToken();
      if (!token) return;
      try {
        const session = await api<CajaSession>(
          `/caja/session?token=${encodeURIComponent(token)}`,
        );
        const store = await api<{
          passDesign?: {
            logoUrl?: string | null;
            backgroundColor?: string | null;
            foregroundColor?: string | null;
          } | null;
        }>(`/stores/${session.storeId}`);
        if (cancelled) return;
        const design = store.passDesign;
        setBrand({
          logoUrl: design?.logoUrl,
          color: design?.backgroundColor || undefined,
          foreground: design?.foregroundColor || undefined,
        });
      } catch {
        /* sin marca disponible: se usa el tema por defecto */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!ready) {
    return <SkeletonScreen />;
  }

  if (!firebaseEnabled) {
    return (
      <p className="p-6 text-center text-sm text-[var(--onda-danger)]">
        Firebase no configurado
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex min-h-dvh max-w-sm flex-col p-6"
    >
      <div className="flex flex-1 flex-col justify-center gap-3">
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
        <Button
          type="submit"
          size="lg"
          fullWidth
          style={{
            background: brand?.color || 'var(--onda-primary-500)',
            color: brand?.foreground || '#FFFFFF',
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
    </form>
  );
}
