import { Suspense, type ReactNode } from 'react';
import { CajaAppShell } from '../CajaAppShell';
import { SkeletonScreen } from '@onda/shared-ui';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SkeletonScreen label="Abriendo caja" />}>
      <CajaAppShell>{children}</CajaAppShell>
    </Suspense>
  );
}
