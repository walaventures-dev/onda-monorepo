'use client';

import { useEffect, useState } from 'react';
import { Button, api } from '@onda/shared-ui';
import type { AccountingProvider } from '@onda/shared-types';

export function PosAccountingConfig({ storeId }: { storeId: string }) {
  const [provider, setProvider] = useState<AccountingProvider>('NONE');
  const [autoSync, setAutoSync] = useState(false);

  useEffect(() => {
    void api<{ provider: AccountingProvider; autoSync: boolean }>(
      `/pos/stores/${storeId}/accounting`
    ).then((c) => {
      setProvider(c.provider);
      setAutoSync(c.autoSync);
    });
  }, [storeId]);

  async function save() {
    await api(`/pos/stores/${storeId}/accounting`, {
      method: 'POST',
      body: JSON.stringify({ provider, autoSync, credentials: {} }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['NONE', 'ALEGRA', 'SIIGO'] as AccountingProvider[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              provider === p
                ? 'bg-[var(--onda-primary)] text-white'
                : 'border border-[var(--onda-border)]'
            }`}
            onClick={() => setProvider(p)}
          >
            {p === 'NONE' ? 'Ninguno' : p === 'ALEGRA' ? 'Alegra' : 'Siigo'}
          </button>
        ))}
      </div>
      {provider !== 'NONE' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
          Sincronizar ventas automáticamente
        </label>
      ) : (
        <p className="text-sm text-[var(--onda-muted)]">
          El POS funciona sin integración contable.
        </p>
      )}
      <Button onPress={() => void save()}>Guardar</Button>
    </div>
  );
}
