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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  logout: () => Promise<void>;
};

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
