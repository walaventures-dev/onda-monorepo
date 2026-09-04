import { createHash, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  parseBillingPeriod,
  parsePlanId,
  quotePlanWithDiscount,
  type BillingPeriod,
  type PlanId,
} from '@onda/shared-utils';

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  get isConfigured(): boolean {
    return Boolean(
      process.env.WOMPI_PUBLIC_KEY &&
        process.env.WOMPI_PRIVATE_KEY &&
        process.env.WOMPI_INTEGRITY_SECRET
    );
  }

  get publicKey(): string | null {
    return process.env.WOMPI_PUBLIC_KEY || null;
  }

  get apiUrl(): string {
    return (process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1').replace(
      /\/$/,
      ''
    );
  }

  amountInCentsFor(
    plan: PlanId,
    billing: BillingPeriod,
    discountPercentage = 0
  ): number {
    return quotePlanWithDiscount(plan, billing, discountPercentage).amountDue * 100;
  }

  /** @deprecated use amountInCentsFor */
  get proAmountInCents(): number {
    return this.amountInCentsFor('PRO', 'monthly');
  }

  createCheckout(input: {
    storeId: string;
    planType: PlanId;
    billingPeriod: BillingPeriod;
    discountPercentage?: number;
    kind?: 'subscribe' | 'plan-change' | 'upgrade';
  }) {
    const kind = input.kind || 'subscribe';
    const reference = `onda-${kind}-${input.storeId}-${Date.now()}`;
    const amountInCents = this.amountInCentsFor(
      input.planType,
      input.billingPeriod,
      input.discountPercentage ?? 0
    );
    const currency = 'COP';
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || '';
    const integrity = createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${integritySecret}`)
      .digest('hex');
    const merchantUrl =
      process.env.NEXT_PUBLIC_MERCHANT_URL || 'http://localhost:4202';

    return {
      reference,
      amountInCents,
      currency,
      publicKey: this.publicKey,
      integrity,
      redirectUrl: `${merchantUrl}/config`,
    };
  }

  parsePlanFromStore(store: {
    planType?: string | null;
    billingPeriod?: string | null;
  }): { planType: PlanId; billingPeriod: BillingPeriod } {
    return {
      planType: parsePlanId(store.planType) || 'BASIC',
      billingPeriod: parseBillingPeriod(store.billingPeriod) || 'monthly',
    };
  }

  verifyEventChecksum(body: Record<string, unknown>): boolean {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    if (!secret) {
      this.logger.warn('WOMPI_EVENTS_SECRET vacío; se acepta el webhook sin firma');
      return true;
    }
    const signature = body.signature as
      | { checksum?: string; properties?: string[] }
      | undefined;
    const checksum = signature?.checksum;
    const properties = signature?.properties;
    const timestamp = body.timestamp;
    if (!checksum || !properties?.length || timestamp == null) return false;

    const values = properties
      .map((path) => this.readPath(body.data, path))
      .join('');
    const expected = createHash('sha256')
      .update(`${values}${timestamp}${secret}`)
      .digest('hex');
    return this.safeEqual(expected, checksum);
  }

  transactionFromEvent(body: Record<string, unknown>): {
    id?: string;
    status?: string;
    reference?: string;
    paymentSourceId?: string | number | null;
  } | null {
    const data = body.data as Record<string, unknown> | undefined;
    const tx = (data?.transaction ?? data) as Record<string, unknown> | undefined;
    if (!tx) return null;
    return {
      id: typeof tx.id === 'string' ? tx.id : undefined,
      status: typeof tx.status === 'string' ? tx.status : undefined,
      reference: typeof tx.reference === 'string' ? tx.reference : undefined,
      paymentSourceId:
        (tx.payment_source_id as string | number | undefined) ?? null,
    };
  }

  async createPaymentSource(input: {
    token: string;
    customerEmail: string;
    acceptanceToken: string;
    acceptPersonalAuth: string;
  }): Promise<{ id: string; stub?: boolean }> {
    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey) {
      const stubId = `stub-ps-${Date.now()}`;
      this.logger.log(`[Wompi stub] payment_source ${stubId}`);
      return { id: stubId, stub: true };
    }
    const res = await fetch(`${this.apiUrl}/payment_sources`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CARD',
        token: input.token,
        customer_email: input.customerEmail,
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.acceptPersonalAuth,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wompi payment_source ${res.status}: ${text}`);
    }
    const json = (await res.json()) as { data?: { id?: number | string } };
    const id = json.data?.id;
    if (id == null) {
      throw new Error('Wompi payment_source sin id');
    }
    return { id: String(id) };
  }

  async chargePaymentSource(input: {
    paymentSourceId: string;
    storeId: string;
    amountInCents: number;
    reference: string;
    customerEmail?: string;
  }) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey) {
      this.logger.log(
        `[Wompi stub] charge store=${input.storeId} source=${input.paymentSourceId} ref=${input.reference} cents=${input.amountInCents}`
      );
      return { ok: true as const, stub: true as const };
    }
    const res = await fetch(`${this.apiUrl}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_in_cents: input.amountInCents,
        currency: 'COP',
        customer_email: input.customerEmail || 'billing@entraenlaonda.com',
        payment_source_id:
          Number(input.paymentSourceId) || input.paymentSourceId,
        reference: input.reference,
        payment_method: { installments: 1 },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wompi charge ${res.status}: ${text}`);
    }
    return res.json() as Promise<unknown>;
  }

  private readPath(root: unknown, path: string): string {
    let cur: unknown = root;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object' && part in (cur as object)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    return cur == null ? '' : String(cur);
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
