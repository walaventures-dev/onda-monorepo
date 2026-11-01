'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonScreen } from '@onda/shared-ui';
import { useCajaSession } from '../CajaAppShell';

/** Entrada de la app: manda al flujo por defecto según la sede. */
export default function IndexPage() {
  const { session } = useCajaSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    router.replace(session.posEnabled ? '/vender' : '/acumular');
  }, [session, router]);

  return <SkeletonScreen label="Abriendo caja" />;
}
