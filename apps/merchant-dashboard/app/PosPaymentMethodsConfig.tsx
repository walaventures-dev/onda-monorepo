'use client';

import { useEffect, useState } from 'react';
import { Button, api } from '@onda/shared-ui';
import type { PosPaymentMethodDto } from '@onda/shared-types';

export function PosPaymentMethodsConfig({ storeId }: { storeId: string }) {
  const [methods, setMethods] = useState<PosPaymentMethodDto[]>([]);

  useEffect(() => {
    void api<PosPaymentMethodDto[]>(`/pos/stores/${storeId}/payment-methods`).then(
      setMethods
    );
  }, [storeId]);

  async function save() {
    await api(`/pos/stores/${storeId}/payment-methods`, {
      method: 'POST',
      body: JSON.stringify({ methods }),
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {methods.map((m, i) => (
          <li key={m.key} className="flex flex-wrap items-center gap-3">
            <label className="block min-w-[12rem] flex-1 space-y-1 text-sm">
              <span className="text-[var(--onda-muted)]">Etiqueta</span>
              <input
                className="onda-input w-full"
                value={m.label}
                onChange={(e) => {
                  const next = [...methods];
                  next[i] = { ...m, label: e.target.value };
                  setMethods(next);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={m.isActive}
                onChange={(e) => {
                  const next = [...methods];
                  next[i] = { ...m, isActive: e.target.checked };
                  setMethods(next);
                }}
              />
              Activo
            </label>
          </li>
        ))}
      </ul>
      <Button onPress={() => void save()}>Guardar</Button>
    </div>
  );
}
