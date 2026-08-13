'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { setApiAuthTokenGetter } from '@onda/shared-ui';
import { getMerchantAuth, isMerchantFirebaseConfigured } from './firebase';

type MerchantAuthValue = {
  ready: boolean;
  firebaseEnabled: boolean;
  user: User | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

/** Mensaje en español. `null` = el usuario canceló (no mostrar error). */
export function mapFirebaseAuthError(
  err: unknown,
  fallback = 'No se pudo iniciar sesión. Revisa los datos e intenta de nuevo.'
): string | null {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const message = err instanceof Error ? err.message : '';
  const hay = `${code} ${message}`;
  if (/popup-closed-by-user|cancelled-popup-request/i.test(hay)) return null;
  if (/popup-blocked/i.test(hay)) {
    return 'Permite las ventanas emergentes para continuar con Google.';
  }
  if (/unauthorized-domain/i.test(hay)) {
    return 'Este dominio no está autorizado. Agrégalo en Firebase Authentication.';
  }
  if (/operation-not-allowed/i.test(hay)) {
    return 'Google no está habilitado. Actívalo en Firebase → Authentication.';
  }
  if (
    /account-exists-with-different-credential|credential-already-in-use/i.test(
      hay
    )
  ) {
    return 'Ese email ya tiene una cuenta. Entra con tu contraseña.';
  }
  if (/auth\/invalid-credential|user-not-found|wrong-password/i.test(hay)) {
    return 'Email o contraseña incorrectos';
  }
  if (/email-already-in-use/i.test(hay)) {
    return 'Ese email ya tiene una cuenta. Inicia sesión.';
  }
  if (/weak-password/i.test(hay)) {
    return 'La contraseña debe tener al menos 6 caracteres';
  }
  return fallback;
}

const MerchantAuthContext = createContext<MerchantAuthValue | null>(null);

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const firebaseEnabled = isMerchantFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) {
      setApiAuthTokenGetter(null);
      return;
    }
    const auth = getMerchantAuth();
    setApiAuthTokenGetter(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
    return () => {
      unsub();
      setApiAuthTokenGetter(null);
    };
  }, [firebaseEnabled]);

  const value = useMemo<MerchantAuthValue>(
    () => ({
      ready,
      firebaseEnabled,
      user,
      email: user?.email ?? null,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getMerchantAuth(), email, password);
      },
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(getMerchantAuth(), email, password);
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(getMerchantAuth(), provider);
      },
      logout: async () => {
        if (firebaseEnabled) await signOut(getMerchantAuth());
        try {
          localStorage.removeItem('onda-merchant-store-id');
        } catch {
          /* ignore */
        }
      },
    }),
    [ready, firebaseEnabled, user]
  );

  return (
    <MerchantAuthContext.Provider value={value}>
      {children}
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth(): MerchantAuthValue {
  const ctx = useContext(MerchantAuthContext);
  if (!ctx) {
    throw new Error('useMerchantAuth debe usarse dentro de MerchantAuthProvider');
  }
  return ctx;
}
