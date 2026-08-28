import { Inject, Injectable } from '@nestjs/common';
import { sanitizeReferralCode } from '@onda/shared-utils';
import { PrismaService } from './prisma.service';
import { PromoCodesService } from './promo-codes.service';

export type ResolvedCode =
  | { kind: 'referral'; code: string; storeName: string }
  | { kind: 'promo'; code: string; discountPercentage: number }
  | { kind: 'expired'; code: string }
  | { kind: 'invalid' };

@Injectable()
export class CodeResolverService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PromoCodesService) private promos: PromoCodesService
  ) {}

  normalize(raw?: string | null): string {
    return sanitizeReferralCode(raw);
  }

  async resolve(raw?: string | null): Promise<ResolvedCode> {
    const code = this.normalize(raw);
    if (!code) return { kind: 'invalid' };

    const store = await this.prisma.store.findUnique({
      where: { referralCode: code },
      select: { name: true, referralCode: true },
    });
    if (store) {
      return {
        kind: 'referral',
        code: store.referralCode,
        storeName: store.name,
      };
    }

    const promo = await this.promos.resolve(code);
    if (promo.status === 'valid') {
      return {
        kind: 'promo',
        code: promo.code,
        discountPercentage: promo.discountPercentage,
      };
    }
    if (promo.status === 'expired') {
      return { kind: 'expired', code: promo.code };
    }

    return { kind: 'invalid' };
  }

  async resolveForSubscription(raw?: string | null): Promise<{
    referredByStoreId?: string;
    promoCode?: string;
    discountPercentage: number;
  }> {
    const resolved = await this.resolve(raw);
    if (resolved.kind === 'referral') {
      const referrer = await this.prisma.store.findUnique({
        where: { referralCode: resolved.code },
        select: { id: true },
      });
      if (!referrer) {
        throw new Error('Código de referido inválido');
      }
      return { referredByStoreId: referrer.id, discountPercentage: 0 };
    }
    if (resolved.kind === 'promo') {
      return {
        promoCode: resolved.code,
        discountPercentage: resolved.discountPercentage,
      };
    }
    if (resolved.kind === 'expired') {
      throw new Error('Este código expiró');
    }
    if (raw?.trim()) {
      throw new Error('Código de referido no válido');
    }
    return { discountPercentage: 0 };
  }
}
