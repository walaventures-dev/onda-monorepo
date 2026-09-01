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
  browserPopupRedirectResolver,
  checkActionCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { api, setApiAuthTokenGetter } from '@onda/shared-ui';
import { getMerchantAuth, isMerchantFirebaseConfigured } from './firebase';
import { requestGoogleAccessToken } from './googleSignIn';

type MerchantAuthValue = {
  ready: boolean;
  firebaseEnabled: boolean;
  user: User | null;
  email: string | null;
  /** Error al volver del redirect de Google; `null` si no hay. */
  googleRedirectError: string | null;
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

function errorHay(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err ?? '');
  return `${code} ${message}`;
}

function isGoogleCancel(err: unknown): boolean {
  return /popup-closed-by-user|cancelled-popup-request|auth\/user-cancelled/i.test(
    errorHay(err)
  );
}

let redirectResultPromise: Promise<unknown> | null = null;

function consumeGoogleRedirect(auth: Auth) {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth, browserPopupRedirectResolver);
  }
  return redirectResultPromise;
}

async function signInWithGoogleAccessToken(auth: Auth, accessToken: string) {
  const credential = GoogleAuthProvider.credential(null, accessToken);
  try {
    await signInWithCredential(auth, credential);
  } catch (err) {
    const prepared = await api<{ retry?: boolean }>('/auth/merchant/google', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    }).catch(() => ({ retry: false as const }));
    if (!prepared?.retry) throw err;
    await signInWithCredential(auth, credential);
  }
}

/** Mensaje en español. `null` = el usuario canceló (no mostrar error). */
export function mapFirebaseAuthError(
  err: unknown,
  fallback = 'No se pudo iniciar sesión. Revisa los datos e intenta de nuevo.'
): string | null {
  const hay = errorHay(err);
  if (isGoogleCancel(err)) return null;
  if (/Firebase no está configurado/i.test(hay)) {
    return 'El inicio de sesión con Google no está disponible en este entorno.';
  }
  if (/popup-blocked/i.test(hay)) {
    return 'Permite las ventanas emergentes para continuar con Google.';
  }
  if (/unauthorized-domain|origin.*not allowed|idpiframe_initialization/i.test(hay)) {
    return 'Este dominio no está autorizado para Google. Agrégalo en Firebase Authentication y en el cliente OAuth (orígenes de JavaScript).';
  }
  if (/operation-not-allowed|configuration-not-found/i.test(hay)) {
    return 'Google no está habilitado. Actívalo en Firebase → Authentication.';
  }
  if (/invalid-api-key|api-key-not-valid/i.test(hay)) {
    return 'La configuración de Firebase no es válida. Revisa las claves públicas.';
  }
  if (/INVALID_IDP_RESPONSE|invalid.idp/i.test(hay)) {
    return 'Google rechazó la conexión. Revisa el cliente OAuth en Firebase Authentication.';
  }
  if (/internal-error|fedcm|missing-or-invalid-nonce|Cross-Origin-Opener/i.test(hay)) {
    return 'No se pudo completar el inicio de sesión en este navegador. Intenta de nuevo o usa Chrome o Safari.';
  }
  if (/network-request-failed/i.test(hay)) {
    return 'Sin conexión. Revisa internet e intenta de nuevo.';
  }
  if (/web-storage-unsupported/i.test(hay)) {
    return 'Este navegador bloquea el almacenamiento. Prueba en otra ventana.';
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
  const [googleRedirectError, setGoogleRedirectError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!firebaseEnabled) {
      setApiAuthTokenGetter(null);
      return;
    }
    const auth = getMerchantAuth();
    auth.languageCode = 'es';
    setApiAuthTokenGetter(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });
    void consumeGoogleRedirect(auth).catch((err) => {
      const msg = mapFirebaseAuthError(
        err,
        'No se pudo continuar con Google. Intenta de nuevo.'
      );
      if (msg) setGoogleRedirectError(msg);
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
      googleRedirectError,
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
        setGoogleRedirectError(null);
        const auth = getMerchantAuth();
        auth.languageCode = 'es';
        const accessToken = await requestGoogleAccessToken();
        await signInWithGoogleAccessToken(auth, accessToken);
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
    [ready, firebaseEnabled, user, googleRedirectError]
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
