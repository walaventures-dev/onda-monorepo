'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setApiAuthTokenGetter } from '@onda/shared-ui';

const TOKEN_KEY = 'onda-organizer-token';

type OrganizerAuthContextValue = {
  ready: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const OrganizerAuthContext = createContext<OrganizerAuthContextValue | null>(
  null
);

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    setApiAuthTokenGetter(async () => token);
    return () => setApiAuthTokenGetter(null);
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string }>('/auth/organizer', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ ready, token, login, logout }),
    [ready, token, login, logout]
  );

  return (
    <OrganizerAuthContext.Provider value={value}>
      {children}
    </OrganizerAuthContext.Provider>
  );
}

export function useOrganizerAuth() {
  const ctx = useContext(OrganizerAuthContext);
  if (!ctx) {
    throw new Error('useOrganizerAuth debe usarse dentro de OrganizerAuthProvider');
  }
  return ctx;
}
