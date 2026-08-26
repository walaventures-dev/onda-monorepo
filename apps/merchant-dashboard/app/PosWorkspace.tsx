'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AnalyticsFiltersValue } from '@onda/shared-ui';
import type { StoreMemberRole } from '@onda/shared-types';
import { PosInventory } from './PosInventory';
import { PosSalesList } from './PosSalesList';
import { PosSaleDetail } from './PosSaleDetail';
import { PosSummaryPanel } from './PosSummaryPanel';
import { PosVenderPanel } from './PosVenderPanel';
import { MerchantCajaPanel } from './MerchantCajaPanel';
import { isAdmin } from '../lib/useStoreRole';

export function PosWorkspace({
  storeId,
  memberRole,
  filters,
  posEnabled,
  paymentMethods = [],
  ondaValue,
}: {
  storeId: string;
  memberRole: StoreMemberRole;
  filters: AnalyticsFiltersValue;
  posEnabled: boolean;
  /** Medio de pago activo en resumen (vacío = todos). */
  paymentMethods?: string[];
  ondaValue?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = isAdmin(memberRole);

  useEffect(() => {
    if (pathname.startsWith('/operacion') || pathname.startsWith('/pos/caja')) {
      router.replace(posEnabled ? '/pos/vender' : '/caja');
    }
  }, [pathname, router, posEnabled]);

  useEffect(() => {
    if (!posEnabled && pathname.startsWith('/pos')) {
      router.replace('/caja');
    }
  }, [posEnabled, pathname, router]);

  if (pathname.startsWith('/operacion') || pathname.startsWith('/pos/caja')) {
    return null;
  }

  if (pathname.startsWith('/caja')) {
    return <MerchantCajaPanel storeId={storeId} />;
  }

  if (!posEnabled) {
    return null;
  }

  if (pathname.startsWith('/pos/ventas/') && pathname.split('/').length >= 4) {
    const saleId = pathname.split('/')[3];
    if (!saleId || saleId === 'ventas') return null;
    return <PosSaleDetail storeId={storeId} saleId={saleId} />;
  }

  if (pathname.startsWith('/pos/inventario')) {
    if (!admin) return <p className="text-sm text-[var(--onda-muted)]">Sin acceso</p>;
    return <PosInventory storeId={storeId} />;
  }

  if (pathname.startsWith('/pos/ventas')) {
    return <PosSalesList storeId={storeId} readOnly={!admin} />;
  }

  if (pathname.startsWith('/pos/vender')) {
    return <PosVenderPanel storeId={storeId} ondaValue={ondaValue} />;
  }

  if (pathname === '/pos' || pathname.startsWith('/pos/')) {
    if (admin)
      return (
        <PosSummaryPanel
          storeId={storeId}
          filters={filters}
          paymentMethods={paymentMethods}
        />
      );
    return <PosVenderPanel storeId={storeId} ondaValue={ondaValue} />;
  }

  return null;
}
