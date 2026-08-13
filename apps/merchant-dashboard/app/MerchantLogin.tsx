'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { GradientButton, OndaLogo } from '@onda/shared-ui';
import { useMerchantAuth } from '../lib/MerchantAuth';

export function MerchantLogin() {
  const { signIn, signUp } = useMerchantAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo iniciar sesión';
      if (/auth\/invalid-credential|user-not-found|wrong-password/i.test(message)) {
        setError('Email o contraseña incorrectos');
      } else if (/email-already-in-use/i.test(message)) {
        setError('Ese email ya tiene una cuenta. Inicia sesión.');
      } else if (/weak-password/i.test(message)) {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else {
        setError('No se pudo iniciar sesión. Revisa los datos e intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[var(--onda-bg)] px-4">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--onda-sky)]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[var(--onda-violet)]/10 blur-3xl"
        aria-hidden
      />
      <div className="onda-card relative w-full max-w-md p-8">
        <OndaLogo className="mb-6" />
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--onda-muted)]">
          Panel del negocio
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold text-[var(--onda-ink)]">
          {mode === 'login' ? 'Entra a tu cuenta' : 'Crea tu cuenta'}
        </h1>
        <p className="mt-2 text-sm text-[var(--onda-muted)]">
          Usa el mismo email con el que registraste tu sede.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--onda-muted)]">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="onda-input w-full"
              placeholder="dueno@negocio.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--onda-muted)]">
              Contraseña
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="onda-input w-full"
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--onda-danger)]">{error}</p>
          ) : null}
          <GradientButton type="submit" disabled={busy} className="w-full">
            {busy
              ? 'Entrando…'
              : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
          </GradientButton>
        </form>
        <p className="mt-5 text-center text-sm text-[var(--onda-muted)]">
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                className="font-medium text-[var(--onda-violet)]"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                className="font-medium text-[var(--onda-violet)]"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Inicia sesión
              </button>
            </>
          )}
        </p>
        <p className="mt-3 text-center text-sm">
          <Link
            href="/onboarding"
            className="font-medium text-[var(--onda-sky)]"
          >
            Registrar un comercio nuevo
          </Link>
        </p>
      </div>
    </div>
  );
}
