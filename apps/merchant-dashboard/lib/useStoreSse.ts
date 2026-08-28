'use client';

import { useEffect, useRef } from 'react';
import { getApiAuthToken, getApiUrl } from '@onda/shared-ui';

export type StoreSsePayload = {
  kind?: string;
  [key: string]: unknown;
};

/** Suscripción al stream SSE del store (`/pending-requests/stream`). */
export function useStoreSse(
  storeId: string | undefined,
  enabled: boolean,
  onEvent: (payload: StoreSsePayload) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!storeId || !enabled) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer = 0;

    async function connect() {
      if (cancelled) return;
      source?.close();
      const token = await getApiAuthToken();
      if (cancelled) return;
      const qs = new URLSearchParams({ storeId: storeId! });
      if (token) qs.set('token', token);
      source = new EventSource(
        `${getApiUrl()}/api/pending-requests/stream?${qs.toString()}`
      );
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as StoreSsePayload;
          if (payload.kind === 'ping') return;
          onEventRef.current(payload);
        } catch {
          /* ignore malformed */
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          void connect();
        }, 2000);
      };
    }

    void connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, [storeId, enabled]);
}
