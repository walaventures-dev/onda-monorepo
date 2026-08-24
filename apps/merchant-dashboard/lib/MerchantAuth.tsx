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
  checkActionCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { api, setApiAuthTokenGetter } from '@onda/shared-ui';
import { getMerchantAuth, isMerchantFirebaseConfigured } from './firebase';

type MerchantAuthValue = {
  ready: boolean;
  firebaseEnabled: boolean;
  user: User | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Valida el oobCode del URL y devuelve el email asociado si existe. */
  verifyPasswordResetCode: (oobCode: string) => Promise<{ email: string | null }>;
  /** Confirma la nueva contraseña con el oobCode del correo. */
  confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
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
  if (/auth\/invalid-email/i.test(hay)) {
    return 'Ese email no es válido';
  }
  if (/auth\/too-many-requests/i.test(hay)) {
    return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  }
  if (/auth\/user-not-found/i.test(hay)) {
    return 'No hay una cuenta con ese email.';
  }
  if (/auth\/expired-action-code/i.test(hay)) {
    return 'Este enlace ya expiró. Solicita uno nuevo.';
  }
  if (/auth\/invalid-action-code/i.test(hay)) {
    return 'Este enlace no es válido o ya se usó. Solicita uno nuevo.';
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
      signUp: async (email, password, name) => {
        const cred = await createUserWithEmailAndPassword(
          getMerchantAuth(),
          email,
          password
        );
        const displayName = name?.trim();
        if (displayName) {
          await updateProfile(cred.user, { displayName });
          await cred.user.reload();
          setUser(getMerchantAuth().currentUser);
        }
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(getMerchantAuth(), provider);
      },
      resetPassword: async (email) => {
        await api('/auth/merchant/password-reset', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
      },
      verifyPasswordResetCode: async (oobCode) => {
        const info = await checkActionCode(getMerchantAuth(), oobCode);
        return { email: info.data.email ?? null };
      },
      confirmPasswordReset: async (oobCode, newPassword) => {
        await firebaseConfirmPasswordReset(
          getMerchantAuth(),
          oobCode,
          newPassword
        );
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
