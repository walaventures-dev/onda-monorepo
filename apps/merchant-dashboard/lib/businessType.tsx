'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export const BUSINESS_TYPES = [
  'Café',
  'Restaurante',
  'Bar',
  'Panadería',
  'Barbería',
  'Tienda',
  'Spa',
  'Gimnasio',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/**
 * Módulos del POS que aplica cada tipo de negocio:
 * - `dining` (Salones y mesas): solo restauración — el cliente se sienta a una mesa.
 * - `stations` (Estaciones): punto donde se prepara o presta el servicio y al
 *   que se separan las comandas. En restauración es cocina/barra; en belleza
 *   son las sillas, cabinas o camillas donde se atiende al cliente.
 */
export type BusinessModule = 'dining' | 'stations';

const MODULES_BY_TYPE: Record<BusinessType, readonly BusinessModule[]> = {
  'Café': ['dining', 'stations'],
  'Restaurante': ['dining', 'stations'],
  'Bar': ['dining', 'stations'],
  'Panadería': ['dining', 'stations'],
  'Barbería': ['stations'],
  'Spa': ['stations'],
  'Tienda': [],
  'Gimnasio': [],
};

export function hasDining(type: BusinessType): boolean {
  return MODULES_BY_TYPE[type].includes('dining');
}

export function hasStations(type: BusinessType): boolean {
  return MODULES_BY_TYPE[type].includes('stations');
}

const STORAGE_KEY = 'onda-mock-business-type';

type BusinessTypeContextValue = {
  businessType: BusinessType;
  setBusinessType: (t: BusinessType) => void;
};

const BusinessTypeContext = createContext<BusinessTypeContextValue>({
  businessType: 'Café',
  setBusinessType: () => {},
});

/** Estado del tipo de negocio (MOCK: localStorage, sin backend). */
export function BusinessTypeProvider({ children }: { children: ReactNode }) {
  const [businessType, setBusinessTypeState] = useState<BusinessType>('Café');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (BUSINESS_TYPES as readonly string[]).includes(saved)) {
        setBusinessTypeState(saved as BusinessType);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function setBusinessType(t: BusinessType) {
    setBusinessTypeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }

  return (
    <BusinessTypeContext.Provider value={{ businessType, setBusinessType }}>
      {children}
    </BusinessTypeContext.Provider>
  );
}

export function useBusinessType() {
  return useContext(BusinessTypeContext);
}
