import { resolveWalletConfig } from './config';
import { WalletApiError } from './errors';
import type {
  CreatePassResponse,
  PassSpec,
  RevokePassResponse,
  UpdatePassResponse,
  UsageResponse,
  WalletClientConfig,
} from './types';

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
    return this.request<CreatePassResponse>('POST', '/api/passes', spec);
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
    return this.request<UpdatePassResponse>(
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
