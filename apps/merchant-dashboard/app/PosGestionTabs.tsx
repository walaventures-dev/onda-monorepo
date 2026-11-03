'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, OndaIcons } from '@onda/shared-ui';
import type {
  PosItemDto,
  StoreMemberRole,
} from '@onda/shared-types';
import { PosInventory } from './PosInventory';
import { PosSalesList } from './PosSalesList';
import { PosTablesConfig } from './PosTablesConfig';
import { PosStationsConfig } from './PosStationsConfig';
import { PosUsersPanel } from './PosUsersPanel';
import { isAdmin } from '../lib/useStoreRole';
import { hasDining, hasStations, useBusinessType } from '../lib/businessType';

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
  const { businessType } = useBusinessType();
  // Salones y mesas solo aplica a restauración; estaciones también a belleza
  // (sillas/cabinas donde se presta el servicio).
  const diningModules = hasDining(businessType);
  const stationModules = hasStations(businessType);
  const [itemCount, setItemCount] = useState(0);

  const inInventory = pathname.startsWith('/pos/inventario');
  const inTables = pathname.startsWith('/pos/mesas');
  const inStations = pathname.startsWith('/pos/estaciones');
  const inTeam = pathname.startsWith('/pos/equipo');
  const gestionRoute = inInventory || inTables || inStations;

  // Si el tipo de negocio no usa un módulo, saca al usuario de esa ruta.
  useEffect(() => {
    if ((inTables && !diningModules) || (inStations && !stationModules)) {
      router.replace('/pos/inventario');
    }
  }, [diningModules, stationModules, inTables, inStations, router]);

  useEffect(() => {
    if (!admin || !storeId) return;
    let cancelled = false;
    api<PosItemDto[]>(`/pos/stores/${storeId}/items`)
      .then((itemRows) => {
        if (cancelled) return;
        setItemCount(itemRows.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [admin, storeId]);

  let panel: ReactNode;
  if (inTables) {
    panel = admin ? <PosTablesConfig storeId={storeId} /> : NO_ACCESS;
  } else if (inStations) {
    panel = admin ? <PosStationsConfig storeId={storeId} /> : NO_ACCESS;
  } else if (inTeam) {
    panel = admin ? <PosUsersPanel storeId={storeId} /> : NO_ACCESS;
  } else if (pathname.startsWith('/pos/ventas')) {
    panel = <PosSalesList storeId={storeId} readOnly={!admin} />;
  } else {
    panel = admin ? <PosInventory storeId={storeId} /> : NO_ACCESS;
  }

  const pill = (active: boolean) =>
    `${TAB_BUTTON} ${
      active
        ? 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
        : 'text-[var(--onda-muted)] hover:bg-[var(--onda-bg)]'
    }`;

  return (
    <div>
      {admin && gestionRoute ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pill(inInventory)}
            onClick={() => {
              if (!inInventory) router.push('/pos/inventario');
            }}
          >
            {OndaIcons.product} Ítems ({itemCount})
          </button>
          {diningModules ? (
            <button
              type="button"
              className={pill(inTables)}
              onClick={() => router.push('/pos/mesas')}
            >
              {OndaIcons.near} Salones y mesas
            </button>
          ) : null}
          {stationModules ? (
            <button
              type="button"
              className={pill(inStations)}
              onClick={() => router.push('/pos/estaciones')}
            >
              {OndaIcons.gear} Estaciones
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4">{panel}</div>
    </div>
  );
}
