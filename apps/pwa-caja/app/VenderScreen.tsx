'use client';

import { useParams, useRouter } from 'next/navigation';
import { SkeletonScreen, VenderMobile } from '@onda/shared-ui';
import { useCajaSession } from './CajaAppShell';

/** Pantallas del flujo Vender, una por ruta (ver VenderMobile). */
export function VenderScreen({
  screen,
  tabId = null,
}: {
  screen: 'list' | 'mesas' | 'detail' | 'grid';
  tabId?: string | null;
}) {
  const { session } = useCajaSession();
  const router = useRouter();
  const params = useParams<{ store: string }>();
  const store = decodeURIComponent(params.store || '');
  if (!session) return <SkeletonScreen />;
  return (
    <VenderMobile
      storeId={session.storeId}
      screen={screen}
      tabId={tabId}
      onNavigate={(path) => router.push(`/${store}${path}`)}
      onAssociateTab={(tabId) => router.push(`/${store}/asociar/${tabId}`)}
    />
  );
}
