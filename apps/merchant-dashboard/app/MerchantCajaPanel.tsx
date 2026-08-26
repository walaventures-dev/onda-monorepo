'use client';

import { OndaIcons } from '@onda/shared-ui';
import { CajaOpenButton } from './PendingRequestsPanel';

/**
 * Pantalla mínima en el merchant: la operación de caja vive en la PWA kiosk.
 * «Abrir caja» en el navbar (y aquí) abre esa única app.
 */
export function MerchantCajaPanel({ storeId }: { storeId: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--onda-primary-50)] text-[var(--onda-primary-500)] [&>svg]:h-7 [&>svg]:w-7">
        {OndaIcons.qr}
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Caja en dispositivo</h2>
        <p className="text-sm leading-relaxed text-[var(--onda-muted)]">
          Acumular ondas, ver cuentas abiertas y asociar clientes se hace en la
          app de caja (celular o tablet del mostrador).
        </p>
      </div>
      <CajaOpenButton storeId={storeId} />
      <p className="text-xs text-[var(--onda-muted)]">
        También puedes usar el botón «Abrir caja» arriba en cualquier momento.
      </p>
    </div>
  );
}
