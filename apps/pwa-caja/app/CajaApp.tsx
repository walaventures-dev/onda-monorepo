'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CajaOperationsPanel, PasswordInput, Button } from '@onda/shared-ui';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getMerchantAuth } from '../lib/firebase';
import { loadDefaultStoreId, useCajaAuth } from '../lib/useCajaAuth';

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
      await signInWithEmailAndPassword(getMerchantAuth(), email.trim(), password);
      router.replace('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  }

  if (!firebaseEnabled) {
    return (
      <p className="p-6 text-center text-sm">
        Usa el enlace kiosk /c/token para caja sin login.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-6"
    >
      <h1 className="font-display text-center text-2xl font-semibold">Caja Onda</h1>
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

export function CajaHubClient() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [storeId, setStoreId] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (firebaseEnabled && !user) {
      router.replace('/login');
      return;
    }
    void loadDefaultStoreId().then(setStoreId);
  }, [ready, user, firebaseEnabled, router]);

  if (!storeId) {
    return <p className="p-6 text-center text-sm">Cargando sede…</p>;
  }

  return (
    <div className="min-h-dvh p-4">
      <CajaOperationsPanel storeId={storeId} />
    </div>
  );
}
