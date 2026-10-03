'use client';

import { useEffect, useState } from 'react';
import {
  DEVICE_ACTIONS,
  devicePing,
  runDeviceAction,
  type DeviceAction,
  type DeviceHealth,
} from '@onda/shared-utils';

type RunState =
  | { status: 'idle' }
  | { status: 'running'; method: string }
  | {
      status: 'done';
      method: string;
      http: number;
      code: number;
      message: string;
      response: string;
    }
  | { status: 'error'; method: string; detail: string };

function formatPing(health: DeviceHealth | null, error: string) {
  if (error) return error;
  if (!health) return 'Comprobando…';
  if (health.sdkReachable) return 'Ping positivo · SDK disponible';
  return 'Ping negativo · SDK no responde';
}

export function CajaDevicePanel() {
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [pingError, setPingError] = useState('');
  const [run, setRun] = useState<RunState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    devicePing()
      .then((next) => {
        if (!cancelled) setHealth(next);
      })
      .catch(() => {
        if (!cancelled) setPingError('Sin dispositivo en 127.0.0.1:8080');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function fire(action: DeviceAction) {
    if (run.status === 'running') return;
    setRun({ status: 'running', method: action.method });
    try {
      const result = await runDeviceAction(action);
      setRun({
        status: 'done',
        method: action.method,
        http: result.status,
        code: result.envelope.code,
        message: result.envelope.message,
        response: result.envelope.response,
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const offline = err instanceof TypeError;
      setRun({
        status: 'error',
        method: action.method,
        detail: aborted
          ? 'Tiempo de espera agotado'
          : offline
            ? 'Sin dispositivo en 127.0.0.1:8080'
            : err instanceof Error
              ? err.message
              : 'No se pudo llamar al dispositivo',
      });
    }
  }

  const pingOk = Boolean(health?.sdkReachable);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <p
        className={`text-center text-xs font-medium ${
          pingError
            ? 'text-[var(--onda-danger)]'
            : pingOk
              ? 'text-[var(--onda-success)]'
              : 'text-[var(--onda-muted)]'
        }`}
      >
        {formatPing(health, pingError)}
      </p>

      {run.status === 'done' || run.status === 'error' ? (
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-3 text-left text-xs text-[var(--onda-ink)]">
          {run.status === 'error'
            ? `${run.method}\n${run.detail}`
            : `${run.method} · HTTP ${run.http}\ncode: ${run.code}\nmessage: ${run.message || '—'}\nresponse: ${run.response || '—'}`}
        </pre>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
        {DEVICE_ACTIONS.map((action) => {
          const busy = run.status === 'running' && run.method === action.method;
          return (
            <button
              key={action.method}
              type="button"
              disabled={run.status === 'running'}
              onClick={() => void fire(action)}
              className="rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-3 text-sm font-semibold text-[var(--onda-ink)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Ejecutando…' : action.method}
            </button>
          );
        })}
      </div>
    </div>
  );
}
