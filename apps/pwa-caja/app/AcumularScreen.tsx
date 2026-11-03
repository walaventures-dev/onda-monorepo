'use client';

import { useParams, useRouter } from 'next/navigation';
import { CajaDualPane, SkeletonScreen, type CajaPane } from '@onda/shared-ui';
import { useCajaSession } from './CajaAppShell';

const PANE_ROUTES: Record<CajaPane, string> = {
  camera: '/acumular',
  queue: '/acumular/solicitudes',
  device: '/acumular/sensores',
};

/** Panel táctil de acumulación; cada pane tiene ruta propia bajo /[store]. */
export function AcumularScreen({ pane }: { pane: CajaPane }) {
  const { session } = useCajaSession();
  const router = useRouter();
  const params = useParams<{ store: string }>();
  const store = decodeURIComponent(params.store || '');
  if (!session) return <SkeletonScreen />;
  return (
    <CajaDualPane
      storeId={session.storeId}
      token={session.token}
      ondaValue={session.ondaValue}
      posEnabled={session.posEnabled}
      activePane={pane}
      onPaneChange={(p) => router.push(`/${store}${PANE_ROUTES[p]}`)}
    />
  );
}
