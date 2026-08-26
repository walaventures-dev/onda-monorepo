'use client';

import type { StoreMemberRole } from '@onda/shared-types';

export function useStoreRole(
  stores: Array<{ id: string; memberRole?: StoreMemberRole }>,
  storeId: string
): StoreMemberRole {
  const store = stores.find((s) => s.id === storeId);
  return store?.memberRole ?? 'ADMIN';
}

export function isAdmin(role: StoreMemberRole) {
  return role === 'ADMIN';
}

export function isCaja(role: StoreMemberRole) {
  return role === 'CAJA' || role === 'ADMIN';
}

/** Rutas del merchant-dashboard permitidas para rol CAJA. */
export function cajaAllowedMerchantPath(pathname: string): boolean {
  if (pathname.startsWith('/caja')) return true;
  if (pathname.startsWith('/pos/vender')) return true;
  if (pathname.startsWith('/pos/ventas')) return true;
  const first = pathname.split('/').filter(Boolean)[0];
  const loyaltyOnly = [
    'resumen',
    'clientes',
    'promos',
    'campanas',
    'eventos',
    'referidos',
    'comparativa',
    'completar',
    'config',
    'pase',
    'cartillas',
  ];
  if (loyaltyOnly.includes(first)) return false;
  if (pathname === '/pos' || pathname === '/pos/') return false;
  if (pathname.startsWith('/pos/inventario')) return false;
  if (pathname.startsWith('/config/')) return false;
  return pathname.startsWith('/pos');
}
