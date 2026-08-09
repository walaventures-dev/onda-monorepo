'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, OndaIcons } from '@onda/shared-ui';
import { useSession, saveSession, clearSession, type CustomerSession } from '../../lib/session';

export function ProfileClient() {
  const session = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (session === null) {
      router.replace('/');
    }
  }, [session, router]);

  if (!session) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
      </div>
    );
  }

  // Captured into its own const so TS keeps the non-null narrowing inside the
  // nested closures below (narrowing on `session` itself doesn't survive
  // into nested function declarations).
  const activeSession = session;

  function startEditing() {
    setName(activeSession.user.name);
    setError('');
    setEditing(true);
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api<CustomerSession['user']>('/customer-auth/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${activeSession.token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      saveSession({ token: activeSession.token, user: updated });
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar tu nombre');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api('/customer-auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeSession.token}` },
      });
    } catch {
      // se limpia la sesión local igual, aunque falle la llamada
    } finally {
      clearSession();
    }
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Perfil</h1>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        <div className="onda-pwa-fields">
          <div>
            <p className="onda-pwa-label">Nombre</p>
            {editing ? (
              <form className="mt-1 flex items-center gap-2" onSubmit={submitName}>
                <input
                  required
                  autoFocus
                  minLength={2}
                  className="onda-pwa-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="submit"
                  className="onda-pwa-link"
                  disabled={busy || name.trim().length < 2}
                >
                  {busy ? 'Guardando…' : 'Guardar'}
                </button>
              </form>
            ) : (
              <div className="onda-pwa-field mt-1 flex items-center justify-between gap-2">
                <span>{session.user.name}</span>
                <button type="button" aria-label="Editar nombre" onClick={startEditing}>
                  {OndaIcons.edit}
                </button>
              </div>
            )}
            {error ? <p className="mt-1 text-sm text-[var(--onda-danger)]">{error}</p> : null}
          </div>

          <div>
            <p className="onda-pwa-label">Teléfono</p>
            <div className="onda-pwa-field mt-1">{session.user.phone}</div>
          </div>
        </div>

        <button
          type="button"
          className="onda-pwa-secondary mt-6"
          onClick={logout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
}
