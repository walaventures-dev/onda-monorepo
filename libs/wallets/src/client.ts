import { resolveWalletConfig } from './config';
import { WalletApiError, isWalletApiError } from './errors';
import type {
  CreatePassResponse,
  GetPassResponse,
  PassSpec,
  RevokePassResponse,
  UpdatePassResponse,
  UsageResponse,
  WalletClientConfig,
} from './types';

function omitProVisuals(spec: PassSpec): PassSpec {
  const next = { ...spec };
  delete next.color;
  delete next.logoURL;
  delete next.thumbnailURL;
  delete next.stripURL;
  delete next.iconURL;
  return next;
}

function hasProVisuals(spec: PassSpec) {
  return Boolean(spec.color || spec.logoURL || spec.thumbnailURL || spec.stripURL || spec.iconURL);
}

function isProPlanError(err: unknown) {
  return isWalletApiError(err) && err.code === 'VALIDATION' && /pro plan/i.test(err.message);
}

type ResolvedConfig = ReturnType<typeof resolveWalletConfig>;

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

/**
 * Cliente HTTP de bajo nivel para WalletWallet.
 * Un método por endpoint canónico; sin lógica de dominio Onda.
 */
export class WalletWalletClient {
  private readonly config: ResolvedConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config?: Partial<WalletClientConfig>) {
    this.config = resolveWalletConfig(config);
    this.fetchImpl = this.config.fetchImpl ?? fetch;
  }

  get isStub(): boolean {
    return this.config.stub;
  }

  get baseUrl(): string {
    return this.config.baseUrl!;
  }

  get proFeatures(): boolean {
    return Boolean(this.config.proFeatures);
  }

  async getUsage(): Promise<UsageResponse> {
    if (this.config.stub) {
      return {
        count: 0,
        limit: 1000,
        remaining: 1000,
        resetDate: '2099-01-01',
        plan: 'free',
      };
    }
    return this.request<UsageResponse>('GET', '/api/auth/usage');
  }

  async createPass(spec: PassSpec): Promise<CreatePassResponse> {
    if (this.config.stub) {
      const serial = `stub-${crypto.randomUUID()}`;
      return {
        serialNumber: serial,
        googleSaveUrl: `${this.config.baseUrl}/stub/google/${serial}`,
        applePass: '',
        shareUrl: `${this.config.baseUrl}/p/${serial}`,
      };
    }
    return this.requestPassWrite<CreatePassResponse>('POST', '/api/passes', spec);
  }

  async getPass(serialNumber: string): Promise<GetPassResponse> {
    if (this.config.stub) {
      return {
        serial: serialNumber,
        createdAt: new Date().toISOString(),
        lastUpdated: Date.now(),
        devices: [],
      };
    }
    return this.request<GetPassResponse>(
      'GET',
      `/api/passes/${encodeURIComponent(serialNumber)}`
    );
  }

  async updatePass(serialNumber: string, spec: PassSpec): Promise<UpdatePassResponse> {
    if (this.config.stub) {
      return {
        serialNumber,
        lastUpdated: Date.now(),
        notifiedDevices: 0,
        unchanged: false,
      };
    }
    return this.requestPassWrite<UpdatePassResponse>(
      'PUT',
      `/api/passes/${encodeURIComponent(serialNumber)}`,
      spec
    );
  }

  async revokePass(serialNumber: string): Promise<RevokePassResponse> {
    if (this.config.stub) {
      return {
        serialNumber,
        deleted: true,
        notifiedDevices: 0,
        alreadyDeleted: false,
      };
    }
    return this.request<RevokePassResponse>(
      'DELETE',
      `/api/passes/${encodeURIComponent(serialNumber)}`
    );
  }

  /** Redirect público a Google Save URL. */
  googleRedirectUrl(serialNumber: string): string {
    return `${this.config.baseUrl}/api/passes/${encodeURIComponent(serialNumber)}/google`;
  }

  /** Descarga directa del `.pkpass` para Apple Wallet. */
  applePkpassUrl(serialNumber: string): string {
    return `${this.config.baseUrl}/p/${encodeURIComponent(serialNumber)}/apple.pkpass`;
  }

  /** POST/PUT: si el plan no admite color/strip/logo, reintenta el spec sin esos campos. */
  private async requestPassWrite<T>(
    method: 'POST' | 'PUT',
    path: string,
    spec: PassSpec
  ): Promise<T> {
    try {
      return await this.request<T>(method, path, spec);
    } catch (err) {
      if (isProPlanError(err) && hasProVisuals(spec)) {
        return this.request<T>(method, path, omitProVisuals(spec));
      }
      throw err;
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new WalletApiError({
        message: err instanceof Error ? err.message : 'Network error talking to Wallet API',
        code: 'NETWORK',
        status: 0,
        body: err,
      });
    }

    const json = await readJsonBody(res);
    if (!res.ok) {
      throw WalletApiError.fromHttp(res.status, json);
    }
    return json as T;
  }
}

let defaultClient: WalletWalletClient | null = null;

/** Singleton lazy — útil desde Nest o scripts. */
export function getWalletClient(
  config?: Partial<WalletClientConfig>
): WalletWalletClient {
  if (config) return new WalletWalletClient(config);
  if (!defaultClient) defaultClient = new WalletWalletClient();
  return defaultClient;
}

/** Resetea el singleton (tests / hot-reload de env). */
export function resetWalletClient(): void {
  defaultClient = null;
}
