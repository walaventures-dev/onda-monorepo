'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadDefaultStoreId, useCajaAuth } from '../../lib/useCajaAuth';
import { CajaOperationsPanel } from '@onda/shared-ui';
import { useState } from 'react';

export default function AsociarPage() {
  const router = useRouter();
  const { ready, user, firebaseEnabled } = useCajaAuth();
  const [storeId, setStoreId] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (firebaseEnabled && !user) {
      router.replace('/login');
      return;
    }
    void loadDefaultStoreId().then(setStoreId);
  }, [ready, user, firebaseEnabled, router]);

  if (!storeId) {
    return <p className="p-6 text-center text-sm">Cargando…</p>;
  }

  return (
    <div className="min-h-dvh p-4">
      <button type="button" className="mb-3 text-sm" onClick={() => router.push('/')}>
        ← Inicio
      </button>
      <CajaOperationsPanel storeId={storeId} defaultMode="asociar" />
    </div>
  );
}
