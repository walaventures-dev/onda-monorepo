import { getWalletClient, WalletWalletClient } from './client';
import { isStubWalletRef } from './config';
import { withNotificationMessage } from './notifications';
import {
  buildPassSpec,
  type CouponPassContext,
  type EventTicketPassContext,
  type LoyaltyPassContext,
  type OndaCardPassContext,
} from './scenarios';
import type {
  CreatePassResponse,
  IssuedPassLinks,
  PassScenarioId,
  PassSpec,
  RevokePassResponse,
  UpdatePassResponse,
  UsageResponse,
  WalletClientConfig,
} from './types';
import type { ScenarioContextMap } from './scenarios';

function toIssuedLinks(created: CreatePassResponse): IssuedPassLinks {
  return {
    walletRef: created.serialNumber,
    serialNumber: created.serialNumber,
    shareUrl: created.shareUrl,
    googleSaveUrl: created.googleSaveUrl,
    googleUrl: created.googleSaveUrl,
    appleUrl: created.shareUrl,
    applePass: created.applePass || undefined,
  };
}

export type IssueScenarioInput<K extends PassScenarioId> = {
  scenario: K;
  context: ScenarioContextMap[K];
};

/**
 * Fachada de dominio sobre WalletWallet.
 * Preferir esta API desde Nest / jobs; usar `WalletWalletClient` solo si hace falta el HTTP crudo.
 */
export class WalletPassService {
  private readonly client: WalletWalletClient;

  constructor(config?: Partial<WalletClientConfig>);
  constructor(client: WalletWalletClient);
  constructor(configOrClient?: Partial<WalletClientConfig> | WalletWalletClient) {
    this.client =
      configOrClient instanceof WalletWalletClient
        ? configOrClient
        : getWalletClient(configOrClient);
  }

  get raw(): WalletWalletClient {
    return this.client;
  }

  get isStub(): boolean {
    return this.client.isStub;
  }

  async getUsage(): Promise<UsageResponse> {
    return this.client.getUsage();
  }

  /** Emite un pass de cualquier escenario registrado. */
  async issue<K extends PassScenarioId>(
    input: IssueScenarioInput<K>
  ): Promise<IssuedPassLinks> {
    const spec = buildPassSpec(input.scenario, input.context, {
      proFeatures: this.client.proFeatures,
    });
    const created = await this.client.createPass(spec);
    return toIssuedLinks(created);
  }

  async issueLoyalty(ctx: LoyaltyPassContext): Promise<IssuedPassLinks> {
    return this.issue({ scenario: 'loyalty', context: ctx });
  }

  async issueOndaCard(ctx: OndaCardPassContext): Promise<IssuedPassLinks> {
    return this.issue({ scenario: 'onda-card', context: ctx });
  }

  async issueCoupon(ctx: CouponPassContext): Promise<IssuedPassLinks> {
    return this.issue({ scenario: 'coupon', context: ctx });
  }

  async issueEventTicket(ctx: EventTicketPassContext): Promise<IssuedPassLinks> {
    return this.issue({ scenario: 'event-ticket', context: ctx });
  }

  /**
   * Actualiza un pass existente con un spec completo reconstruido.
   * WalletWallet reemplaza el body entero — no hay PATCH parcial.
   */
  async updateWithSpec(
    walletRef: string,
    spec: PassSpec
  ): Promise<UpdatePassResponse | { ok: true; stub: true }> {
    if (isStubWalletRef(walletRef)) {
      return { ok: true, stub: true };
    }
    return this.client.updatePass(walletRef, spec);
  }

  /** Reconstruye el escenario y hace PUT (p.ej. cambio de puntos). */
  async updateScenario<K extends PassScenarioId>(
    walletRef: string,
    input: IssueScenarioInput<K>
  ): Promise<UpdatePassResponse | { ok: true; stub: true }> {
    const spec = buildPassSpec(input.scenario, input.context, {
      proFeatures: this.client.proFeatures,
    });
    return this.updateWithSpec(walletRef, spec);
  }

  async updateLoyalty(
    walletRef: string,
    ctx: LoyaltyPassContext
  ): Promise<UpdatePassResponse | { ok: true; stub: true }> {
    return this.updateScenario(walletRef, { scenario: 'loyalty', context: ctx });
  }

  async updateOndaCard(
    walletRef: string,
    ctx: OndaCardPassContext
  ): Promise<UpdatePassResponse | { ok: true; stub: true }> {
    return this.updateScenario(walletRef, { scenario: 'onda-card', context: ctx });
  }

  /**
   * Push de banner custom: requiere que el pass se haya creado con el anchor
   * (los builders ya lo incluyen). Hay que enviar el spec completo + mensaje nuevo.
   */
  async notify(
    walletRef: string,
    currentSpec: PassSpec,
    message: string
  ): Promise<UpdatePassResponse | { ok: true; stub: true }> {
    return this.updateWithSpec(walletRef, withNotificationMessage(currentSpec, message));
  }

  async revoke(walletRef: string): Promise<RevokePassResponse | { ok: true; stub: true }> {
    if (isStubWalletRef(walletRef)) {
      return { ok: true, stub: true };
    }
    return this.client.revokePass(walletRef);
  }

  /** Atajo: create crudo si ya tienes un PassSpec. */
  async createRaw(spec: PassSpec): Promise<CreatePassResponse> {
    return this.client.createPass(spec);
  }
}

let defaultService: WalletPassService | null = null;

export function getWalletPassService(
  config?: Partial<WalletClientConfig>
): WalletPassService {
  if (config) return new WalletPassService(config);
  if (!defaultService) defaultService = new WalletPassService();
  return defaultService;
}

export function resetWalletPassService(): void {
  defaultService = null;
}
