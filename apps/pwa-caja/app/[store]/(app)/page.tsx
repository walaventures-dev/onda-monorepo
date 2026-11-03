'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SkeletonScreen } from '@onda/shared-ui';
import { useCajaSession } from '../../CajaAppShell';

/** Entrada de la app: manda al flujo por defecto según sede y rol del usuario. */
export default function IndexPage() {
  const { session } = useCajaSession();
  const router = useRouter();
  const params = useParams<{ store: string }>();
  const store = decodeURIComponent(params.store || '');

  useEffect(() => {
    if (!session || !store) return;
    const role = session.posUser?.role;
    if (role === 'PREPARACION') {
      router.replace(
        session.token
          ? `/${store}/cocina?token=${encodeURIComponent(session.token)}`
          : `/${store}/cocina`,
      );
      return;
    }
    router.replace(session.posEnabled ? `/${store}/vender` : `/${store}/acumular`);
  }, [session, store, router]);

  return <SkeletonScreen label="Abriendo caja" />;
}
