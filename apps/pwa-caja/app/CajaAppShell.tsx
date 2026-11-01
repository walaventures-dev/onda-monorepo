'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CajaBottomNav,
  CajaIdentityBar,
  SkeletonScreen,
  api,
  setApiAuthTokenGetter,
} from '@onda/shared-ui';
import { CurrencyDollarIcon as CurrencyDollar } from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { CookingPotIcon as CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';
import { signOut } from 'firebase/auth';
import { getMerchantAuth, isMerchantFirebaseConfigured } from '../lib/firebase';
import { loadDefaultStoreId, useCajaAuth } from '../lib/useCajaAuth';
import { clearCajaToken, readCajaToken, writeCajaToken } from './CajaApp';

export type CajaSession = {
  storeId: string;
  storeName: string;
  posEnabled?: boolean;
  ondaValue?: number | null;
  /** Token CajaLink activo (SSE/cocina), si la sesión viene de un enlace. */
  token?: string;
};

type CajaSessionContextValue = {
  /** null mientras se resuelve la sesión. */
  session: CajaSession | null;
};

const CajaSessionContext = createContext<CajaSessionContextValue>({
  session: null,
});

export function useCajaSession() {
  return useContext(CajaSessionContext);
}

function useFirebaseApiToken() {
  setApiAuthTokenGetter(async () => {
    const user = getMerchantAuth().currentUser;
    return user ? user.getIdToken() : null;
  });
}

/**
 * Shell de la app de caja: resuelve la sesión (enlace kiosk o hub Firebase),
 * pinta el chrome compartido (identidad + nav inferior) y expone la sesión
 * por contexto a las páginas de rutas.
 */
export function CajaAppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [session, setSession] = useState<CajaSession | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  // Token: ?token= en la URL gana; si no, el guardado en el dispositivo.
  const tokenParam = searchParams.get('token');

  useEffect(() => {
    if (!ready || session) return;
    let cancelled = false;

    async function openWithToken(token: string) {
      setApiAuthTokenGetter(async () => token);
      try {
        const s = await api<CajaSession>(
          `/caja/session?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        writeCajaToken(token);
        setSession({ ...s, token });
      } catch {
        if (cancelled) return;
        // Enlace revocado/caduco: limpiar y volver a login (o al flujo hub).
        clearCajaToken();
        setApiAuthTokenGetter(null);
        if (isMerchantFirebaseConfigured()) {
          void signOut(getMerchantAuth()).catch(() => undefined);
          router.replace('/login');
        } else {
          router.replace('/');
        }
      }
    }

    async function openHub() {
      if (firebaseEnabled) useFirebaseApiToken();
      else setApiAuthTokenGetter(null);
      const storeId = await loadDefaultStoreId();
      if (!storeId || cancelled) return;
      try {
        const link = await api<{ token: string; url: string }>('/caja/link', {
          method: 'POST',
          body: JSON.stringify({ storeId }),
        });
        if (cancelled) return;
        await openWithToken(link.token);
      } catch {
        if (!cancelled) clearCajaToken();
      }
    }

    if (tokenParam) {
      void openWithToken(tokenParam);
      return;
    }
    const stored = readCajaToken();
    if (stored) {
      void openWithToken(stored);
      return;
    }
    if (firebaseEnabled && !user) {
      router.replace('/login');
      return;
    }
    void openHub();

    return () => {
      cancelled = true;
      setApiAuthTokenGetter(null);
    };
    // pathname: re-evaluar al volver de /login u otra ruta.
  }, [ready, session, user, firebaseEnabled, tokenParam, router, pathname]);

  const handleLogout = useCallback(async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      clearCajaToken();
      setApiAuthTokenGetter(null);
      if (isMerchantFirebaseConfigured()) {
        await signOut(getMerchantAuth()).catch(() => undefined);
        router.replace('/login');
      } else {
        router.replace('/');
      }
    } finally {
      setLogoutBusy(false);
    }
  }, [logoutBusy, router]);

  if (!session) {
    return <SkeletonScreen label="Abriendo caja" />;
  }

  const inVender = pathname.startsWith('/vender');
  const inAcumular = pathname.startsWith('/acumular');

  const navItems = [
    ...(session.posEnabled
      ? [
          {
            id: 'vender',
            label: 'Vender',
            icon: (
              <CurrencyDollar
                className="h-5 w-5"
                weight={inVender ? 'fill' : 'regular'}
                aria-hidden
              />
            ),
            active: inVender,
            onSelect: () => router.push('/vender'),
          },
        ]
      : []),
    {
      id: 'acumular',
      label: 'Acumular',
      icon: (
        <QrCode
          className="h-5 w-5"
          weight={inAcumular ? 'fill' : 'regular'}
          aria-hidden
        />
      ),
      active: inAcumular,
      onSelect: () => router.push('/acumular'),
    },
    ...(session.token
      ? [
          {
            id: 'cocina',
            label: 'Cocina',
            icon: <CookingPot className="h-5 w-5" weight="regular" aria-hidden />,
            href: `/cocina?token=${encodeURIComponent(session.token)}`,
          },
        ]
      : []),
  ];

  return (
    <CajaSessionContext.Provider value={{ session }}>
      <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-3 overflow-hidden p-4">
        <CajaIdentityBar
          storeName={session.storeName}
          onLogout={() => void handleLogout()}
          logoutBusy={logoutBusy}
        />
        {/* Solo el contenido scrollea; header y bottom nav quedan fijos. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <CajaBottomNav items={navItems} />
      </main>
    </CajaSessionContext.Provider>
  );
}
