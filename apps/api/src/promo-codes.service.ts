import { Inject, Injectable, Logger } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from './firestore.service';

export type PromoCodeDoc = {
  discountPercentage: number;
  startDate: Date;
  endDate: Date;
};

export type PromoResolveResult =
  | { status: 'valid'; code: string; discountPercentage: number }
  | { status: 'expired'; code: string }
  | { status: 'not_found' };

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    const sec = Number((value as { _seconds: number })._seconds);
    if (Number.isFinite(sec)) return new Date(sec * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(@Inject(FirestoreService) private firestore: FirestoreService) {}

  async resolve(code: string): Promise<PromoResolveResult> {
    if (!this.firestore.isConfigured) {
      this.logger.warn('Firestore no configurado; promo no encontrada');
      return { status: 'not_found' };
    }

    const snap = await this.firestore.getDb().collection('codes').doc(code).get();
    if (!snap.exists) {
      return { status: 'not_found' };
    }

    const data = snap.data() as Record<string, unknown> | undefined;
    const discountPercentage = Number(data?.discountPercentage);
    const startDate = toDate(data?.startDate);
    const endDate = toDate(data?.endDate);

    if (
      !Number.isFinite(discountPercentage) ||
      discountPercentage < 0 ||
      discountPercentage > 100 ||
      !startDate ||
      !endDate
    ) {
      this.logger.warn(`Código promo inválido en Firestore: ${code}`);
      return { status: 'not_found' };
    }

    const now = Date.now();
    if (now < startDate.getTime() || now > endDate.getTime()) {
      return { status: 'expired', code };
    }

    return { status: 'valid', code, discountPercentage };
  }

  async getValid(code: string): Promise<PromoCodeDoc | null> {
    const result = await this.resolve(code);
    if (result.status !== 'valid') return null;
    const snap = await this.firestore
      .getDb()
      .collection('codes')
      .doc(code)
      .get();
    const data = snap.data() as Record<string, unknown> | undefined;
    const startDate = toDate(data?.startDate);
    const endDate = toDate(data?.endDate);
    if (!startDate || !endDate) return null;
    return {
      discountPercentage: result.discountPercentage,
      startDate,
      endDate,
    };
  }
}
