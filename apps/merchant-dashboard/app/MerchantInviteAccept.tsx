'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PasswordInput, api } from '@onda/shared-ui';
import { useMerchantAuth } from '../lib/MerchantAuth';

export function MerchantInviteAccept() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const router = useRouter();
  const { signUp, user, ready } = useMerchantAuth();
  const [preview, setPreview] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    void api(`/auth/invite/${token}`).then(setPreview).catch(() => setError('Invitación inválida'));
  }, [token]);

  useEffect(() => {
    if (!ready || !user || !token) return;
    void api('/auth/invite/' + token + '/accept', { method: 'POST' }).then((res: any) => {
      if (res.role === 'CAJA') {
        window.location.href =
          (process.env.NEXT_PUBLIC_CAJA_URL || 'http://localhost:4204') + '/';
      } else {
        router.replace('/resumen');
      }
    });
  }, [ready, user, token, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview?.email) return;
    setError('');
    try {
      await signUp(preview.email, password, preview.name);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta');
    }
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-[var(--onda-muted)]">{error || 'Cargando invitación…'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="onda-card w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-xl font-semibold">Únete a {preview.storeName}</h1>
        <p className="text-sm text-[var(--onda-muted)]">
          Crea tu contraseña para acceder como {preview.role === 'CAJA' ? 'caja' : preview.role}.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Correo</span>
          <input className="onda-input w-full" value={preview.email} readOnly disabled />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Contraseña</span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
        <Button type="submit" className="w-full">
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}
