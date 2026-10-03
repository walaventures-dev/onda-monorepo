/** Cliente del servidor local POS (`docs/device.md`). Solo loopback. */

export const DEVICE_BASE = 'http://127.0.0.1:8080';

export type DeviceEnvelope = {
  code: number;
  message: string;
  response: string;
};

export type DeviceHealth = {
  ok: boolean;
  initialized: boolean;
  lastPongAt: string | null;
  sdkReachable: boolean;
};

export type DeviceAction = {
  method: string;
  /** Cuerpo de prueba. Vacío si la acción no lleva campos. */
  body?: Record<string, unknown>;
  /** Lecturas de tarjeta: la petición permanece abierta hasta ~60 s. */
  slow?: boolean;
};

const HEX_16 = '00112233445566778899AABBCCDDEEFF';

/** Todas las acciones POST /v1 documentadas, con un cuerpo de prueba usable. */
export const DEVICE_ACTIONS: DeviceAction[] = [
  { method: 'sysInit' },
  { method: 'getVersion' },
  { method: 'getSN' },
  { method: 'showLog', body: { enable: true } },
  { method: 'printString', body: { text: 'Hola' } },
  { method: 'printImage' },
  { method: 'printReceipt' },
  { method: 'openCutter' },
  { method: 'openCashBox' },
  { method: 'printLabel' },
  { method: 'setPrintLabelLength', body: { length: 400 } },
  { method: 'is80MMPrinter' },
  { method: 'scanHeadPowerOn' },
  { method: 'readQr', slow: true, body: { timeout: 60 } },
  {
    method: 'downloadMasterKey',
    body: { keyIndex: 0, masterKey: HEX_16 },
  },
  {
    method: 'downloadWorkKey',
    body: {
      keyIndex: 0,
      pinKey: HEX_16,
      macKey: HEX_16,
      tdkKey: HEX_16,
    },
  },
  { method: 'readBankCard', slow: true },
  { method: 'readContactlessCard', slow: true },
  { method: 'readNfcTag', slow: true },
  { method: 'readM1Card', slow: true },
  {
    method: 'writeM1Card',
    slow: true,
    body: {
      block: 40,
      data: HEX_16,
      password: 'FFFFFFFFFFFF',
    },
  },
  { method: 'emvInit' },
  { method: 'searchCard', slow: true, body: { mode: 0, timeout: 60 } },
  { method: 'iccReset', body: { slot: 0 } },
  { method: 'rfReset' },
  { method: 'secondaryScreenImage' },
  { method: 'secondaryScreenString', body: { text: 'Bienvenido' } },
];

function isEnvelope(value: unknown): value is DeviceEnvelope {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.code === 'number' && typeof row.message === 'string';
}

export async function devicePing(timeoutMs = 1500): Promise<DeviceHealth> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${DEVICE_BASE}/health`, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`Ping HTTP ${res.status}`);
    }
    const data = (await res.json()) as DeviceHealth;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function runDeviceAction(
  action: DeviceAction,
  timeoutMs?: number,
  external?: AbortSignal,
): Promise<{ status: number; envelope: DeviceEnvelope }> {
  const ctrl = new AbortController();
  const onExternal = () => ctrl.abort();
  if (external?.aborted) ctrl.abort();
  else external?.addEventListener('abort', onExternal);
  const ms = timeoutMs ?? (action.slow ? 75_000 : 20_000);
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${DEVICE_BASE}/v1/${action.method}`, {
      method: 'POST',
      headers: action.body ? { 'Content-Type': 'application/json' } : undefined,
      body: action.body ? JSON.stringify(action.body) : undefined,
      signal: ctrl.signal,
    });
    const raw: unknown = await res.json().catch(() => null);
    if (!isEnvelope(raw)) {
      throw new Error(`HTTP ${res.status} sin sobre JSON`);
    }
    return { status: res.status, envelope: raw };
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternal);
  }
}
