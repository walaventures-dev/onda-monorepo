'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
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
import { clearCajaToken, readCajaToken, writeCajaToken } from '../lib/caja-token';
import { clearPosToken, readPosToken } from '../lib/pos-session';

export type PosUserInfo = {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'ATENCION' | 'CAJA' | 'PREPARACION';
};

export type CajaSession = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  posEnabled?: boolean;
  ondaValue?: number | null;
  /** Token CajaLink activo (SSE/cocina), si la sesión viene de un enlace. */
  token?: string;
  /** Usuario de caja (sesión usuario+PIN). */
  posUser?: PosUserInfo;
  /** Todos los usuarios ven las comandas de todos. */
  posSharedTabs?: boolean;
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

/**
 * Shell de la app de caja, rutada por negocio: /[store]/...
 * Resuelve la sesión (enlace kiosk o usuario+PIN), valida que pertenezca a
 * la tienda de la URL, pinta el chrome compartido y expone la sesión por
 * contexto a las páginas de rutas.
 */
export function CajaAppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ store: string }>();
  const store = decodeURIComponent(params.store || '');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<CajaSession | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  // Token de enlace: ?token= en la URL gana; si no, el guardado en el dispositivo.
  const tokenParam = searchParams.get('token');

  useEffect(() => {
    if (session || !store) return;
    let cancelled = false;

    /** La sesión es de otra tienda: llevar al usuario a la URL correcta. */
    function redirectToStore(slug: string, suffix: string) {
      if (cancelled) return;
      clearCajaToken();
      clearPosToken();
      setApiAuthTokenGetter(null);
      router.replace(`/${slug}${suffix}`);
    }

    async function openWithToken(token: string) {
      setApiAuthTokenGetter(async () => token);
      try {
        const s = await api<CajaSession>(
          `/caja/session?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (s.storeSlug && s.storeSlug !== store) {
          redirectToStore(s.storeSlug, `/?token=${encodeURIComponent(token)}`);
          return;
        }
        writeCajaToken(token);
        setSession({ ...s, token });
      } catch {
        if (cancelled) return;
        // Enlace revocado/caduco o sesión expirada: limpiar y volver a login.
        clearCajaToken();
        clearPosToken();
        setApiAuthTokenGetter(null);
        router.replace(`/${store}/login`);
      }
    }

    async function openWithPosSession() {
      const token = readPosToken();
      if (!token) {
        router.replace(`/${store}/login`);
        return;
      }
      setApiAuthTokenGetter(async () => token);
      try {
        const s = await api<{
          user: PosUserInfo;
          store: {
            id: string;
            slug: string;
            name: string;
            ondaValue: number | null;
            maxStamps: number;
            posEnabled: boolean;
            posSharedTabs: boolean;
          };
        }>('/pos/users/session');
        if (cancelled) return;
        if (s.store.slug !== store) {
          // Sesión de otra tienda: se abre esa tienda (o su login).
          redirectToStore(s.store.slug, '/');
          return;
        }
        setSession({
          storeId: s.store.id,
          storeSlug: s.store.slug,
          storeName: s.store.name,
          posEnabled: s.store.posEnabled,
          ondaValue: s.store.ondaValue,
          posSharedTabs: s.store.posSharedTabs,
          posUser: s.user,
          // El JWT de usuario sirve como ?token= en SSE/cocina: resolveAccess
          // del API lo acepta igual que el enlace de caja.
          token,
        });
      } catch {
        if (cancelled) return;
        clearPosToken();
        setApiAuthTokenGetter(null);
        router.replace(`/${store}/login`);
      }
    }

    if (tokenParam) {
      void openWithToken(tokenParam);
      return;
    }
    const storedLink = readCajaToken();
    if (storedLink) {
      void openWithToken(storedLink);
      return;
    }
    void openWithPosSession();

    return () => {
      cancelled = true;
      setApiAuthTokenGetter(null);
    };
    // pathname: re-evaluar al volver de login u otra ruta.
  }, [session, store, tokenParam, router, pathname]);

  const handleLogout = useCallback(async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      clearCajaToken();
      clearPosToken();
      setApiAuthTokenGetter(null);
      router.replace(`/${store}/login`);
    } finally {
      setLogoutBusy(false);
    }
  }, [logoutBusy, router, store]);

  if (!session) {
    return <SkeletonScreen label="Abriendo caja" />;
  }

  const inVender = pathname.startsWith(`/${store}/vender`);
  const inAcumular = pathname.startsWith(`/${store}/acumular`);
  const role = session.posUser?.role;
  const canSell = !role || role === 'ADMIN' || role === 'ATENCION' || role === 'CAJA';
  const canKitchen = !role || role === 'ADMIN' || role === 'PREPARACION';

  const navItems = [
    ...(session.posEnabled && canSell
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
            onSelect: () => router.push(`/${store}/vender`),
          },
        ]
      : []),
    ...(canSell
      ? [
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
            onSelect: () => router.push(`/${store}/acumular`),
          },
        ]
      : []),
    ...(session.token && canKitchen
      ? [
          {
            id: 'cocina',
            label: 'Cocina',
            icon: <CookingPot className="h-5 w-5" weight="regular" aria-hidden />,
            href: `/${store}/cocina?token=${encodeURIComponent(session.token)}`,
          },
        ]
      : []),
  ];

  return (
    <CajaSessionContext.Provider value={{ session }}>
      <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-3 overflow-hidden p-4">
        <CajaIdentityBar
          storeName={session.storeName}
          userName={session.posUser?.name}
          onLogout={() => void handleLogout()}
          logoutBusy={logoutBusy}
        />
        {/* Solo el contenido scrollea; header y bottom nav quedan fijos. El
            padding inferior da aire a la bottom bar en todas las vistas. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <CajaBottomNav items={navItems} />
      </main>
    </CajaSessionContext.Provider>
  );
}
