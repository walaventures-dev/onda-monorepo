import {
  PLAN_SMS_REACH_MONTHLY,
  SMS_OVERAGE_COP,
} from '@onda/shared-types';
import { parsePlanId, type PlanId } from '@onda/shared-utils';

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function campaignReachPricing(opts?: {
  freeMonthly?: number;
  unitCop?: number;
  planType?: PlanId | string | null;
}) {
  const plan = parsePlanId(opts?.planType) || 'BASIC';
  const freeMonthly = Math.max(
    0,
    opts?.freeMonthly ?? PLAN_SMS_REACH_MONTHLY[plan]
  );
  const unitCop = Math.max(
    0,
    opts?.unitCop ?? envInt('CAMPAIGN_REACH_PRICE_COP', SMS_OVERAGE_COP)
  );
  return { freeMonthly, unitCop };
}

/** @deprecated Legacy pack pricing */
export function campaignPricing() {
  const { freeMonthly, unitCop } = campaignReachPricing();
  return {
    freeMonthly,
    unitCop,
    packSize: 0,
    packDiscount: 0,
    packCop: 0,
  };
}
