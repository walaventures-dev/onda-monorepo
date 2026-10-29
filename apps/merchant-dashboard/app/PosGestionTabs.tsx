'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OndaIcons } from '@onda/shared-ui';
import type { StoreMemberRole } from '@onda/shared-types';
import { PosInventory } from './PosInventory';
import { PosSalesList } from './PosSalesList';
import { PosTablesConfig } from './PosTablesConfig';
import { PosStationsConfig } from './PosStationsConfig';
import { isAdmin } from '../lib/useStoreRole';

const TAB_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition';

const NO_ACCESS = (
  <p className="text-sm text-[var(--onda-muted)]">Sin acceso</p>
);

export function PosGestionTabs({
  storeId,
  memberRole,
}: {
  storeId: string;
  memberRole: StoreMemberRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = isAdmin(memberRole);

  // Salones y mesas (/pos/mesas) y Estaciones (/pos/estaciones) viven dentro
  // de Inventario — la fila de navegación de PosInventory ya los enlaza.
  const activeTab = pathname.startsWith('/pos/ventas') ? 'ventas' : 'inventario';

  let panel: ReactNode;
  if (pathname.startsWith('/pos/mesas')) {
    panel = admin ? <PosTablesConfig storeId={storeId} /> : NO_ACCESS;
  } else if (pathname.startsWith('/pos/estaciones')) {
    panel = admin ? <PosStationsConfig storeId={storeId} /> : NO_ACCESS;
  } else if (activeTab === 'ventas') {
    panel = <PosSalesList storeId={storeId} readOnly={!admin} />;
  } else {
    panel = admin ? <PosInventory storeId={storeId} /> : NO_ACCESS;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {admin ? (
          <button
            type="button"
            className={`${TAB_BUTTON} ${
              activeTab === 'inventario'
                ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
            }`}
            onClick={() => {
              if (!pathname.startsWith('/pos/inventario'))
                router.push('/pos/inventario');
            }}
          >
            {OndaIcons.product} Inventario
          </button>
        ) : null}
        <button
          type="button"
          className={`${TAB_BUTTON} ${
            activeTab === 'ventas'
              ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
              : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
          }`}
          onClick={() => {
            if (!pathname.startsWith('/pos/ventas')) router.push('/pos/ventas');
          }}
        >
          {OndaIcons.wallet} Ventas
        </button>
      </div>
      <div className="mt-4">{panel}</div>
    </div>
  );
}
