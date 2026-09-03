'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CajaOperationsPanel,
  PasswordInput,
  Button,
  api,
  setApiAuthTokenGetter,
  SkeletonScreen,
  OndaWordmark,
  type PosVenderMemberSession,
} from '@onda/shared-ui';
import type { PosAttendantDto } from '@onda/shared-types';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getMerchantAuth, isMerchantFirebaseConfigured } from '../lib/firebase';
import { loadDefaultStoreId, useCajaAuth } from '../lib/useCajaAuth';

type CajaSession = {
  storeId: string;
  storeName: string;
  posEnabled?: boolean;
  ondaValue?: number | null;
};

function useFirebaseApiToken() {
  setApiAuthTokenGetter(async () => {
    const user = getMerchantAuth().currentUser;
    return user ? user.getIdToken() : null;
  });
}

/** Espera a que Firebase restaure la sesión persistida del dispositivo. */
function waitForFirebaseUser(): Promise<User | null> {
  const auth = getMerchantAuth();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

function useCajaMemberAuth(storeId: string, cajaToken: string) {
  /** Vuelve al bearer del enlace; no cierra Firebase (sesión de Vender persiste). */
  const restoreCajaAuth = useCallback(() => {
    setApiAuthTokenGetter(async () => cajaToken);
  }, [cajaToken]);

  const fetchMemberSession = useCallback(async (): Promise<PosVenderMemberSession> => {
    const me = await api<PosAttendantDto>(`/pos/stores/${storeId}/me`);
    return { memberId: me.id, name: me.name, role: me.role };
  }, [storeId]);

  const activateMemberAuth = useCallback(async () => {
    if (!isMerchantFirebaseConfigured() || !getMerchantAuth().currentUser) {
      throw new Error('Sesión de miembro no disponible');
    }
    useFirebaseApiToken();
  }, []);

  /** Si Firebase ya tiene usuario (mismo dispositivo), reutiliza sin pedir clave. */
  const resumeMemberSession = useCallback(async (): Promise<PosVenderMemberSession | null> => {
    if (!isMerchantFirebaseConfigured() || !storeId) return null;
    const user = await waitForFirebaseUser();
    if (!user) return null;
    useFirebaseApiToken();
    try {
      return await fetchMemberSession();
    } catch {
      restoreCajaAuth();
      return null;
    }
  }, [storeId, fetchMemberSession, restoreCajaAuth]);

  const signInMember = useCallback(
    async (email: string, password: string): Promise<PosVenderMemberSession> => {
      if (!isMerchantFirebaseConfigured()) {
        throw new Error('Firebase no está configurado en esta caja');
      }
      await signInWithEmailAndPassword(
        getMerchantAuth(),
        email.trim(),
        password,
      );
      useFirebaseApiToken();
      try {
        return await fetchMemberSession();
      } catch (e) {
        restoreCajaAuth();
        void signOut(getMerchantAuth()).catch(() => undefined);
        throw e instanceof Error
          ? e
          : new Error('No eres miembro activo de esta sede');
      }
    },
    [fetchMemberSession, restoreCajaAuth],
  );

  return {
    signInMember,
    restoreCajaAuth,
    activateMemberAuth,
    resumeMemberSession,
  };
}

function CajaClosedScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <OndaWordmark className="h-6 w-auto" />
      <h1 className="font-display text-2xl font-bold text-[var(--onda-ink)]">
        Caja cerrada
      </h1>
      <p className="max-w-xs text-sm text-[var(--onda-muted)]">
        Esta sesión ya no es válida. Genera un enlace nuevo con «Abrir caja» en
        el panel del comercio.
      </p>
    </main>
  );
}

/** App única de caja (kiosk): acumular + vender + cuentas. */
export function CajaKioskClient({ token }: { token: string }) {
  const [session, setSession] = useState<CajaSession | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);

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

  const storeId = session?.storeId || '';
  const {
    signInMember,
    restoreCajaAuth,
    activateMemberAuth,
    resumeMemberSession,
  } = useCajaMemberAuth(storeId, token);

  const handleLogout = useCallback(async () => {
    try {
      await api('/caja/close', { method: 'POST' });
    } catch {
      /* igual cerramos localmente */
    }
    setApiAuthTokenGetter(null);
    if (isMerchantFirebaseConfigured()) {
      void signOut(getMerchantAuth()).catch(() => undefined);
    }
    setClosed(true);
  }, []);

  if (closed) {
    return <CajaClosedScreen />;
  }

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
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CajaOperationsPanel
        storeId={session.storeId}
        storeName={session.storeName}
        posEnabled={Boolean(session.posEnabled)}
        ondaValue={session.ondaValue}
        token={token}
        signInMember={signInMember}
        restoreCajaAuth={restoreCajaAuth}
        activateMemberAuth={activateMemberAuth}
        resumeMemberSession={resumeMemberSession}
        onLogout={handleLogout}
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

  const {
    signInMember,
    restoreCajaAuth,
    activateMemberAuth,
    resumeMemberSession,
  } = useCajaMemberAuth(storeId, cajaToken || '');

  const handleLogout = useCallback(async () => {
    if (cajaToken) {
      setApiAuthTokenGetter(async () => cajaToken);
      try {
        await api('/caja/close', { method: 'POST' });
      } catch {
        /* igual salimos */
      }
    }
    setApiAuthTokenGetter(null);
    if (isMerchantFirebaseConfigured()) {
      await signOut(getMerchantAuth()).catch(() => undefined);
    }
    router.replace('/login');
  }, [cajaToken, router]);

  if (!storeId) {
    return <SkeletonScreen label="Cargando sede" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CajaOperationsPanel
        storeId={storeId}
        storeName={storeName || undefined}
        posEnabled={posEnabled}
        ondaValue={ondaValue}
        token={cajaToken}
        signInMember={cajaToken ? signInMember : undefined}
        restoreCajaAuth={cajaToken ? restoreCajaAuth : undefined}
        activateMemberAuth={cajaToken ? activateMemberAuth : undefined}
        resumeMemberSession={cajaToken ? resumeMemberSession : undefined}
        onLogout={handleLogout}
      />
    </main>
  );
}
