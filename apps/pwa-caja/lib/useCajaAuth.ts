'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { setApiAuthTokenGetter, api } from '@onda/shared-ui';
import { getMerchantAuth, isMerchantFirebaseConfigured } from './firebase';

export function useCajaAuth() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ email: string | null } | null>(null);

  useEffect(() => {
    if (!isMerchantFirebaseConfigured()) {
      setReady(true);
      return;
    }
    const auth = getMerchantAuth();
    setApiAuthTokenGetter(async () => auth.currentUser?.getIdToken() ?? null);
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { email: u.email } : null);
      setReady(true);
    });
  }, []);

  return { ready, user, firebaseEnabled: isMerchantFirebaseConfigured() };
}

export async function loadDefaultStoreId(): Promise<string> {
  const arr = await api<Array<{ id: string }>>('/auth/merchant/stores');
  return arr[0]?.id ?? '';
}
