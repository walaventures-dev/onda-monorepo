'use client';

import Link from 'next/link';
import { CajaOperationsPanel } from '@onda/shared-ui';
import { CajaOpenButton } from './PendingRequestsPanel';

export function MerchantCajaPanel({
  storeId,
  posEnabled = false,
}: {
  storeId: string;
  posEnabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <CajaOperationsPanel storeId={storeId} posEnabled={posEnabled} />
      <div className="onda-card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-[var(--onda-ink)]">Dispositivo dedicado</h3>
        <p className="text-sm text-[var(--onda-muted)]">
          Genera un enlace kiosk para un celular o tablet fijo en mostrador, o abre la PWA de caja
          en otra pestaña.
        </p>
        <div className="flex flex-wrap gap-3">
          <CajaOpenButton storeId={storeId} />
          <Link
            href={(process.env.NEXT_PUBLIC_CAJA_URL || 'http://localhost:4204') + '/'}
            className="inline-flex items-center rounded-full border border-[var(--onda-border)] px-4 py-2 text-sm font-medium"
            target="_blank"
            rel="noreferrer"
          >
            Abrir PWA caja
          </Link>
        </div>
      </div>
    </div>
  );
}
