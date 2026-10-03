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

const CAJA_TOKEN_KEY = 'onda-caja-token';

function readCajaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CAJA_TOKEN_KEY) || '';
}

function writeCajaToken(token: string) {
  localStorage.setItem(CAJA_TOKEN_KEY, token);
}

function clearCajaToken() {
  localStorage.removeItem(CAJA_TOKEN_KEY);
}

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

/** App única de caja (kiosk): acumular + vender + cuentas. */
export function CajaKioskClient({
  token,
  onInvalid,
}: {
  token: string;
  /** Si el token no abre la caja. Sin esto, va a inicio de sesión. */
  onInvalid?: () => void;
}) {
  const router = useRouter();
  const [session, setSession] = useState<CajaSession | null>(null);

  useEffect(() => {
    setApiAuthTokenGetter(async () => token);
    let cancelled = false;
    void api<CajaSession>(`/caja/session?token=${encodeURIComponent(token)}`)
      .then((s) => {
        if (cancelled) return;
        writeCajaToken(token);
        setSession(s);
      })
      .catch(() => {
        if (cancelled) return;
        if (readCajaToken() === token) clearCajaToken();
        if (onInvalid) onInvalid();
        else router.replace('/login');
      });
    return () => {
      cancelled = true;
      setApiAuthTokenGetter(null);
    };
  }, [token, router, onInvalid]);

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
    clearCajaToken();
    setApiAuthTokenGetter(null);
    if (isMerchantFirebaseConfigured()) {
      await signOut(getMerchantAuth()).catch(() => undefined);
    }
    router.replace('/login');
  }, [router]);

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
            backgroundColor?: string;
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
          className="w-full"
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

/** Hub: abre con el token guardado; si no vale, pide inicio de sesión. */
export function CajaHubClient() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [boot, setBoot] = useState<'checking' | 'kiosk' | 'hub'>('checking');
  const [kioskToken, setKioskToken] = useState('');
  const [storeId, setStoreId] = useState('');
  const [posEnabled, setPosEnabled] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ondaValue, setOndaValue] = useState<number | null>(null);
  const [cajaToken, setCajaToken] = useState<string | undefined>();
  const openWithLogin = useCallback(() => setBoot('hub'), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const stored = readCajaToken();
      if (stored) {
        setApiAuthTokenGetter(async () => stored);
        try {
          await api<CajaSession>(
            `/caja/session?token=${encodeURIComponent(stored)}`,
          );
          if (cancelled) return;
          setKioskToken(stored);
          setBoot('kiosk');
          return;
        } catch {
          clearCajaToken();
          if (isMerchantFirebaseConfigured()) useFirebaseApiToken();
          else setApiAuthTokenGetter(null);
        }
      }
      if (!cancelled) setBoot('hub');
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (boot !== 'hub' || !ready) return;
    if (firebaseEnabled && !user) {
      router.replace('/login');
      return;
    }
    if (firebaseEnabled) useFirebaseApiToken();
    void (async () => {
      const id = await loadDefaultStoreId();
      if (!id) return;
      setStoreId(id);
      try {
        const link = await api<{ token: string; url: string }>('/caja/link', {
          method: 'POST',
          body: JSON.stringify({ storeId: id }),
        });
        writeCajaToken(link.token);
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
        clearCajaToken();
        setPosEnabled(false);
      }
    })();
  }, [boot, ready, user, firebaseEnabled, router]);

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
    clearCajaToken();
    setApiAuthTokenGetter(null);
    if (isMerchantFirebaseConfigured()) {
      await signOut(getMerchantAuth()).catch(() => undefined);
    }
    router.replace('/login');
  }, [cajaToken, router]);

  if (boot === 'checking' || !ready) {
    return <SkeletonScreen label="Abriendo caja" />;
  }

  if (boot === 'kiosk' && kioskToken) {
    return (
      <CajaKioskClient
        token={kioskToken}
        onInvalid={openWithLogin}
      />
    );
  }

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
