import {
  CAMPAIGN_PACK_DISCOUNT,
  CAMPAIGN_PACK_SIZE,
  CAMPAIGN_PRICE_COP,
  PLAN_SMS_CAMPAIGNS_MONTHLY,
} from '@onda/shared-types';
import { campaignCatalogPricing } from '@onda/shared-utils';

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function envFloat(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

export function campaignPricing() {
  const freeMonthly = Math.max(0, envInt('CAMPAIGN_FREE_MONTHLY', PLAN_SMS_CAMPAIGNS_MONTHLY));
  const unitCop = Math.max(0, envInt('CAMPAIGN_PRICE_COP', CAMPAIGN_PRICE_COP));
  const packSize = Math.max(1, envInt('CAMPAIGN_PACK_SIZE', CAMPAIGN_PACK_SIZE));
  const packDiscount = Math.min(
    0.9,
    Math.max(0, envFloat('CAMPAIGN_PACK_DISCOUNT', CAMPAIGN_PACK_DISCOUNT))
  );
  return campaignCatalogPricing({
    freeMonthly,
    unitCop,
    packSize,
    packDiscount,
  });
}
