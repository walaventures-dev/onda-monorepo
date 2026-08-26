'use client';

import Link from 'next/link';
import { CajaOpenButton } from './PendingRequestsPanel';

export function PosCajaLink({ storeId }: { storeId: string }) {
  return (
    <div className="onda-card space-y-4 p-6">
      <h2 className="font-display text-xl font-semibold">Abrir caja</h2>
      <p className="text-sm text-[var(--onda-muted)]">
        App de caja: acumular ondas o vincular ventas activas con teléfono o QR. También puedes
        generar un enlace kiosk para un dispositivo compartido.
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
  );
}
