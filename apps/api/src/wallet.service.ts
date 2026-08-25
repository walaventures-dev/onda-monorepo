import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WalletPassService,
  buildLoyaltyPassSpec,
  isStubWalletRef,
  storeLockScreenLocations,
  withNotificationMessage,
  type IssuedPassLinks,
  type LoyaltyPassContext,
  type PassDesignInput,
  type PassLocation,
} from '@onda/wallets';
import { PrismaService } from './prisma.service';
import { pickLoyaltyReward, type LoyaltyRewardHint } from '@onda/shared-utils';
import { resolvePassDesign, toPassDesignInput } from './pass-design.util';

export type IssuePassInput = {
  serialNumber: string;
  points: number;
  design: PassDesignInput;
  holderName: string;
  organizationName?: string;
  maxStamps?: number;
  validUntil?: Date | string | null;
  kind?: 'store' | 'event';
  locations?: PassLocation[];
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

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  linksFor(walletRef: string): IssuedPassLinks {
    return this.passes.linksFor(walletRef);
  }

  /**
   * True solo si WalletWallet reporta al menos un dispositivo
   * que ya instaló el pase (`devices.length > 0`).
   */
  async isActive(walletRef: string | null | undefined): Promise<boolean> {
    if (isStubWalletRef(walletRef)) return false;
    try {
      const status = await this.passes.getStatus(walletRef as string);
      return this.passes.isInstalled(status);
    } catch (err) {
      this.logger.warn(
        `Wallet status failed for ${walletRef}: ${
          err instanceof Error ? err.message : err
        }`
      );
      return false;
    }
  }

  async issuePass(input: IssuePassInput): Promise<IssuedPassLinks> {
    const ctx = this.toLoyaltyContext(input);
    ctx.reward = await this.loadRewardBySerial(input.serialNumber, input.points);
    if (!ctx.locations?.length) {
      ctx.locations = await this.lookupStoreLocations(
        input.serialNumber,
        input.points,
        input.maxStamps,
        ctx.reward
      );
    }
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
   * Un solo PUT: WalletWallet exige el body entero. Si hay `notifyMessage`,
   * el mismo PUT dispara el banner (anchor de notificaciones) — no hace falta
   * un notify() aparte.
   */
  async updatePoints(
    walletRef: string,
    points: number,
    notifyMessage?: string
  ) {
    if (isStubWalletRef(walletRef)) {
      this.logger.log(
        `Wallet stub update ${walletRef} -> ${points}${
          notifyMessage ? ` notify=${notifyMessage}` : ''
        }`
      );
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
      const spec = await buildLoyaltyPassSpec(ctx, {
        proFeatures: this.passes.raw.proFeatures,
      });
      const body = notifyMessage
        ? withNotificationMessage(spec, notifyMessage)
        : spec;
      const result = await this.passes.updateWithSpec(walletRef, body);
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
      const current = await buildLoyaltyPassSpec(ctx, {
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
      validUntil: input.validUntil ?? null,
      kind: input.kind,
      locations: input.locations,
    };
  }

  private rewardFromPass(
    pass: {
      cycleStartedAt: Date;
      promoAssignments: Array<{
        pointsRequired: number;
        promotionId: string;
        promotion: { title: string; isActive: boolean };
      }>;
      transactions: Array<{
        type: string;
        promotionId: string | null;
        createdAt: Date;
      }>;
    },
    points: number
  ): LoyaltyRewardHint | null {
    const claimed = pass.transactions
      .filter(
        (t) =>
          t.type === 'REDEEM' &&
          t.promotionId &&
          t.createdAt.getTime() >= pass.cycleStartedAt.getTime()
      )
      .map((t) => t.promotionId as string);
    return pickLoyaltyReward({
      points,
      claimedPromotionIds: claimed,
      rewards: pass.promoAssignments.map((a) => ({
        title: a.promotion.title,
        pointsRequired: a.pointsRequired,
        promotionId: a.promotionId,
        isActive: a.promotion.isActive,
      })),
    });
  }

  private async loadRewardBySerial(
    serialNumber: string,
    points: number
  ): Promise<LoyaltyRewardHint | null> {
    const pass = await this.prisma.pass.findFirst({
      where: { serialNumber },
      include: {
        promoAssignments: { include: { promotion: true } },
        transactions: { where: { type: 'REDEEM' } },
      },
    });
    if (!pass) return null;
    return this.rewardFromPass(pass, points);
  }

  private async lookupStoreLocations(
    serialNumber: string,
    points: number,
    maxStamps?: number,
    reward?: LoyaltyRewardHint | null
  ): Promise<PassLocation[]> {
    const pass = await this.prisma.pass.findFirst({
      where: { serialNumber },
      select: {
        store: { select: { name: true, lat: true, lng: true, maxStamps: true } },
        cartilla: { select: { maxStamps: true } },
      },
    });
    const max = maxStamps ?? pass?.cartilla?.maxStamps ?? pass?.store?.maxStamps ?? 12;
    return storeLockScreenLocations(pass?.store, points, max, reward);
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
        cartilla: { include: { passDesign: true } },
        promoAssignments: { include: { promotion: true } },
        transactions: { where: { type: 'REDEEM' } },
      },
    });

    if (!pass) return null;

    const design = toPassDesignInput(
      pass.eventId && pass.event?.passDesign
        ? resolvePassDesign(pass.event.passDesign)
        : pass.cartilla?.passDesign || pass.store?.passDesign
          ? resolvePassDesign(
              pass.cartilla?.passDesign,
              pass.store?.passDesign
            )
          : FALLBACK_DESIGN
    );

    const points = pointsOverride ?? pass.points;
    const assignments = pass.cartillaId
      ? pass.promoAssignments.filter((a) => a.cartillaId === pass.cartillaId)
      : pass.promoAssignments;
    const reward = this.rewardFromPass(
      { ...pass, promoAssignments: assignments },
      points
    );
    const maxStamps = pass.cartilla?.maxStamps ?? pass.store?.maxStamps;

    return {
      barcodeSerial: pass.serialNumber,
      points,
      holderName: pass.user.name,
      organizationName: pass.store?.name ?? pass.event?.name ?? design.title,
      design: {
        title: design.title,
        subtitle: design.subtitle,
        description: design.description,
        backgroundColor: design.backgroundColor,
        foregroundColor: design.foregroundColor,
        labelColor: design.labelColor,
        logoUrl: design.logoUrl ?? null,
        stripImageUrl: design.stripImageUrl ?? null,
      },
      maxStamps,
      validUntil: pass.cartilla?.endsAt ?? null,
      kind: pass.eventId ? 'event' : 'store',
      reward,
      locations: storeLockScreenLocations(
        pass.store,
        points,
        maxStamps ?? 12,
        reward
      ),
    };
  }
}
