import { Injectable, Logger } from '@nestjs/common';
import {
  WalletPassService,
  buildLoyaltyPassSpec,
  isStubWalletRef,
  type IssuedPassLinks,
  type LoyaltyPassContext,
  type PassDesignInput,
} from '@onda/wallets';
import { PrismaService } from './prisma.service';

export type IssuePassInput = {
  serialNumber: string;
  points: number;
  design: PassDesignInput;
  holderName: string;
  organizationName?: string;
  maxStamps?: number;
  kind?: 'store' | 'event';
};

const FALLBACK_DESIGN: PassDesignInput = {
  title: 'Onda',
  subtitle: 'Loyalty',
  description: '',
  backgroundColor: '#052DDE',
  foregroundColor: '#FFFFFF',
  labelColor: '#E5F6FC',
  logoUrl: null,
  stripImageUrl: null,
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly passes = new WalletPassService();

  constructor(private readonly prisma: PrismaService) {}

  async issuePass(input: IssuePassInput): Promise<IssuedPassLinks> {
    const ctx = this.toLoyaltyContext(input);
    this.logger.log(
      `Wallet issue loyalty barcode=${ctx.barcodeSerial} stub=${this.passes.isStub}`
    );
    try {
      return await this.passes.issueLoyalty(ctx);
    } catch (err) {
      this.logger.error(
        `Wallet issue failed for ${ctx.barcodeSerial}`,
        err instanceof Error ? err.stack : err
      );
      throw err;
    }
  }

  /**
   * Actualiza ondas en el pass instalado.
   * Reconstruye el PassSpec completo desde DB (WalletWallet exige PUT con body entero).
   */
  async updatePoints(walletRef: string, points: number) {
    if (isStubWalletRef(walletRef)) {
      this.logger.log(`Wallet stub update ${walletRef} -> ${points}`);
      return { ok: true as const, stub: true as const };
    }

    const ctx = await this.loadLoyaltyContextByWalletRef(walletRef, points);
    if (!ctx) {
      this.logger.warn(
        `No se pudo reconstruir contexto wallet para ${walletRef}; se omite update`
      );
      return { ok: false as const, reason: 'missing_context' as const };
    }

    try {
      const result = await this.passes.updateLoyalty(walletRef, ctx);
      return { ok: true as const, result };
    } catch (err) {
      // Best-effort: no tumbar la transacción de puntos por un fallo de push.
      this.logger.error(
        `Wallet update failed for ${walletRef}`,
        err instanceof Error ? err.stack : err
      );
      return { ok: false as const, reason: 'api_error' as const };
    }
  }

  async notify(walletRef: string, message: string) {
    if (isStubWalletRef(walletRef)) {
      this.logger.log(`Wallet stub notify ${walletRef}: ${message}`);
      return { ok: true as const, stub: true as const };
    }

    const ctx = await this.loadLoyaltyContextByWalletRef(walletRef);
    if (!ctx) {
      return { ok: false as const, reason: 'missing_context' as const };
    }

    try {
      const current = buildLoyaltyPassSpec(ctx, {
        proFeatures: this.passes.raw.proFeatures,
      });
      const result = await this.passes.notify(walletRef, current, message);
      return { ok: true as const, result };
    } catch (err) {
      this.logger.error(
        `Wallet notify failed for ${walletRef}`,
        err instanceof Error ? err.stack : err
      );
      return { ok: false as const, reason: 'api_error' as const };
    }
  }

  async revoke(walletRef: string) {
    if (isStubWalletRef(walletRef)) {
      return { ok: true as const, stub: true as const };
    }
    try {
      return await this.passes.revoke(walletRef);
    } catch (err) {
      this.logger.error(
        `Wallet revoke failed for ${walletRef}`,
        err instanceof Error ? err.stack : err
      );
      return { ok: false as const, reason: 'api_error' as const };
    }
  }

  private toLoyaltyContext(input: IssuePassInput): LoyaltyPassContext {
    return {
      barcodeSerial: input.serialNumber,
      points: input.points,
      holderName: input.holderName,
      organizationName: input.organizationName,
      design: input.design,
      maxStamps: input.maxStamps,
      kind: input.kind,
    };
  }

  private async loadLoyaltyContextByWalletRef(
    walletRef: string,
    pointsOverride?: number
  ): Promise<LoyaltyPassContext | null> {
    const pass = await this.prisma.pass.findFirst({
      where: { walletRef },
      include: {
        user: true,
        store: { include: { passDesign: true } },
        event: { include: { passDesign: true } },
      },
    });

    if (!pass) return null;

    const design =
      pass.store?.passDesign ||
      pass.event?.passDesign ||
      FALLBACK_DESIGN;

    return {
      barcodeSerial: pass.serialNumber,
      points: pointsOverride ?? pass.points,
      holderName: pass.user.name,
      organizationName: pass.store?.name ?? pass.event?.name ?? design.title,
      design: {
        title: design.title,
        subtitle: design.subtitle,
        description: design.description,
        backgroundColor: design.backgroundColor,
        foregroundColor: design.foregroundColor,
        labelColor: design.labelColor,
        logoUrl: design.logoUrl,
        stripImageUrl: design.stripImageUrl ?? null,
      },
      maxStamps: pass.store?.maxStamps,
      kind: pass.eventId ? 'event' : 'store',
    };
  }
}
