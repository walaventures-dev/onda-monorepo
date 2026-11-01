import { useEffect, useState } from 'react';
import { api } from './api';
import { StoreCategory } from '@onda/shared-types';

/**
 * true/false según si el tipo de negocio usa mesas (solo restaurantes).
 * undefined mientras se resuelve; si la consulta falla, asume true para
 * no romper el flujo de negocios que ya usan mesas.
 */
export function useHasPosTables(storeId: string): boolean | undefined {
  const [hasTables, setHasTables] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setHasTables(undefined);
    void (async () => {
      try {
        const store = await api<{ category?: string | null }>(
          `/stores/${storeId}`,
        );
        if (!cancelled) setHasTables(store.category === StoreCategory.RESTAURANT);
      } catch {
        if (!cancelled) setHasTables(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return hasTables;
}
