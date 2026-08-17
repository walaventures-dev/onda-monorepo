import { useEffect, useState } from 'react';

export type CustomerSession = {
  token: string;
  user: { id: string; name: string; phone: string };
};

const KEY = 'onda_customer_session';
const SESSION_CHANGED_EVENT = 'onda-session-changed';

export function loadSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomerSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CustomerSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

/** Replaces the current history entry so Back won't restore the login view. */
export function replaceLoginHistory() {
  if (typeof window === 'undefined') return;
  const prev = window.history.state;
  const state =
    prev !== null && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...prev, ondaAuthed: true }
      : { ondaAuthed: true };
  window.history.replaceState(state, '', window.location.href);
}

export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function useSession(): CustomerSession | null | undefined {
  const [session, setSession] = useState<CustomerSession | null | undefined>(undefined);

  useEffect(() => {
    function sync() {
      setSession(loadSession());
    }
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  }, []);

  return session;
}
