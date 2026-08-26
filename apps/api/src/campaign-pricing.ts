import {
  CAMPAIGN_FREE_REACH_MONTHLY,
  CAMPAIGN_REACH_PRICE_COP,
} from '@onda/shared-types';

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function campaignReachPricing(opts?: {
  freeMonthly?: number;
  unitCop?: number;
}) {
  const freeMonthly = Math.max(
    0,
    opts?.freeMonthly ??
      envInt('CAMPAIGN_FREE_REACH_MONTHLY', CAMPAIGN_FREE_REACH_MONTHLY)
  );
  const unitCop = Math.max(
    0,
    opts?.unitCop ?? envInt('CAMPAIGN_REACH_PRICE_COP', CAMPAIGN_REACH_PRICE_COP)
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
