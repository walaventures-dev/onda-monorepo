import {
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  STORE_SUBCATEGORIES_BY_CATEGORY,
  STORE_SEGMENTS_BY_SUBCATEGORY,
} from '@onda/shared-types';

/** E.164 phone validation and helpers */

/** Slug público: lowercase, kebab-case, sin acentos */
export function normalizeStoreSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function isSubcategoryOfCategory(
  category: StoreCategory | string,
  subcategory: StoreSubcategory | string
): boolean {
  const list =
    STORE_SUBCATEGORIES_BY_CATEGORY[category as StoreCategory] || [];
  return list.includes(subcategory as StoreSubcategory);
}

export function isSegmentOfSubcategory(
  subcategory: StoreSubcategory | string,
  segment: StoreSegment | string
): boolean {
  const list =
    STORE_SEGMENTS_BY_SUBCATEGORY[subcategory as StoreSubcategory] || [];
  return list.includes(segment as StoreSegment);
}

export function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Normaliza mientras el usuario escribe (sin mínimo de longitud). */
export function formatReferralCodeInput(raw: string | null | undefined): string {
  try {
    return decodeURIComponent((raw || '').trim())
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
  } catch {
    return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  }
}

/** Extrae el código limpio al validar o pegar desde .env / share. */
export function sanitizeReferralCode(raw: string | null | undefined): string {
  const upper = (raw || '').trim().toUpperCase().replace(/["']/g, '');
  const fromEnv = upper.match(/=\s*([A-Z0-9]{4,16})\s*$/)?.[1];
  if (fromEnv) return fromEnv;
  return formatReferralCodeInput(raw);
}

export const REFERRAL_CODE_MIN_LENGTH = 8;

export function isReferralCodeComplete(raw: string | null | undefined): boolean {
  return sanitizeReferralCode(raw).length >= REFERRAL_CODE_MIN_LENGTH;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone.trim());
}

/** Digits only from any phone string */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Máscara de visualización: (xxx) xxx - xxxx
 * Usa los últimos 10 dígitos (móvil CO / US style).
 */
export function formatPhoneMask(input: string): string {
  let d = phoneDigits(input);
  // Si viene con código país 57, quedarnos con los 10 locales
  if (d.startsWith('57') && d.length > 10) {
    d = d.slice(-10);
  }
  d = d.slice(0, 10);

  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);

  if (d.length === 0) return '';
  if (d.length <= 3) return `(${a}`;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b} - ${c}`;
}

/** True si hay exactamente 10 dígitos locales */
export function isCompletePhoneMask(input: string): boolean {
  let d = phoneDigits(input);
  if (d.startsWith('57') && d.length >= 12) d = d.slice(-10);
  return d.length === 10;
}

/** Normalize Colombian mobile numbers to E.164 */
export function toE164Colombia(input: string): string {
  const digits = phoneDigits(input);
  if (digits.startsWith('57') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57${digits}`;
  }
  if (input.trim().startsWith('+') && isValidE164(input.trim())) {
    return input.trim();
  }
  if (digits.length === 10) {
    return `+57${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/** Formato máscara desde E.164 o crudo (para tablas) */
export function displayPhone(input: string | null | undefined): string {
  if (!input) return '—';
  const masked = formatPhoneMask(input);
  return masked || input;
}

export function formatDateEs(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ONDA_TZ = 'America/Bogota';

/** Día de calendario que eligió el comercio (YYYY-MM-DD), sin correrlo por zona horaria. */
export function cartillaDayKey(input: Date | string): string {
  return String(typeof input === 'string' ? input : input.toISOString()).slice(
    0,
    10,
  );
}

export function todayBogotaKey(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: ONDA_TZ });
}

/** Noon UTC del día elegido: misma fecha en Colombia y en el ISO. */
export function parseCartillaDay(raw: string): Date {
  const [y, m, d] = cartillaDayKey(raw).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

export function cartillaCoversToday(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  const today = todayBogotaKey(now);
  if (startsAt && cartillaDayKey(startsAt) > today) return false;
  if (endsAt && cartillaDayKey(endsAt) < today) return false;
  return true;
}

export function formatCartillaDay(
  input: Date | string,
  month: 'long' | 'short' = 'long',
): string {
  const [y, m, d] = cartillaDayKey(input).split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('es-CO', { day: 'numeric', month })
    .replace('.', '');
}

export function cartillaDeadlineLabel(
  endsAt: Date | string | null | undefined,
  isDefault?: boolean,
): string | null {
  if (endsAt) return `Hasta el ${formatCartillaDay(endsAt)}`;
  if (isDefault) return 'Hasta nuevo aviso';
  return null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function randomSerial(prefix = 'ONDA'): string {
  const part = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${part}`;
}

/** Normaliza a #RRGGBB; si falla, usa fallback */
export function normalizeHexColor(input: string, fallback = '#6E5AE6'): string {
  const raw = (input || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, a, b, c] = raw;
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export const DEFAULT_BRAND_PRIMARY = '#6E5AE6';
export const DEFAULT_BRAND_SECONDARY = '#3DB9E8';

/** Color principal (+ secundario opcional) → texto con contraste; el secundario pinta etiquetas. */
export function derivePassPalette(
  backgroundColor: string,
  secondaryColor?: string | null
): {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
} {
  const bg = normalizeHexColor(backgroundColor, DEFAULT_BRAND_PRIMARY);
  const { r, g, b } = hexToRgb(bg);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const dark = luminance < 0.55;
  const derivedLabel = dark ? '#E5F6FC' : '#6B7289';
  const secondary = (secondaryColor || '').trim();
  return {
    backgroundColor: bg,
    foregroundColor: dark ? '#FFFFFF' : '#1A1B2E',
    labelColor: secondary
      ? normalizeHexColor(secondary, derivedLabel)
      : derivedLabel,
  };
}

export {
  OBJECTIVE_KINDS,
  OBJECTIVE_TITLES,
  OBJECTIVE_DETAIL_FIELDS,
  DEFAULT_INACTIVE_DAYS,
  DEFAULT_MIN_VISITS,
  DEFAULT_MAX_POINTS_GAP,
  DEFAULT_ACTIVE_WITHIN_DAYS,
  DEFAULT_REDEEM_WITHIN_DAYS,
  voiceFor,
  objectiveLabel,
  objectiveHint,
  objectiveDetailFields,
  clampObjectiveDetail,
  recommendedObjectiveDetails,
  objectiveAudienceQueryParams,
  defaultPromo,
  promoForType,
  promoHeadline,
  buildCampaignMessages,
  buildObjectiveMessages,
  renderCampaignTemplate,
  CAMPAIGN_CHANNELS,
  type ObjectiveKind,
  type ObjectiveDetails,
  type ObjectiveDetailFieldDef,
  type ObjectiveDetailFieldKey,
  type VerticalVoice,
  type CampaignPromo,
  type CampaignPromoType,
  type CampaignMessage,
  type CampaignChannelLabel,
} from './campaign-copy';

export {
  feedbackDimensionsFor,
  feedbackDimensionLabel,
  type FeedbackDimensionDef,
  type FeedbackDimensionId,
} from './feedback-dimensions';

export {
  type LoyaltyRewardHint,
  pickLoyaltyReward,
  loyaltyProgressCopy,
  buildEnrollmentSmsMessage,
} from './loyalty-copy';

export {
  type PromoBenefitInput,
  parsePositiveInt,
  manualOndasOrDefault,
  ondasFromPayment,
  computeRoi,
  computeBenefitAmount,
  needsClaimPaymentAmount,
  needsClaimBenefitInput,
} from './loyalty-money';

export { ONDA_CLAIM_QR_PREFIX, claimQrPayload, parseCajaQr } from './caja-qr';

export {
  calcChange,
  posLineSubtotal,
  TEAM_LIMITS,
  maxCajaSeats,
  DEFAULT_PAYMENT_METHODS,
} from './pos';

export {
  type PlanId,
  type BillingPeriod,
  type TimelineMonthKind,
  type SubscriptionMonth,
  PLAN_MONTHLY,
  PLAN_EFFECTIVE,
  BILLING_MONTHS,
  BILLING_PERIOD_DAYS,
  FIRST_CYCLE_BONUS_DAYS,
  REFERRAL_BONUS_DAYS,
  USAGE_BILLING_DAYS,
  WOMPI_MIN_CHARGE_COP,
  BILLING_ISSUER,
  PLAN_META,
  formatCop,
  campaignReachQuote,
  formatCampaignRoi,
  campaignPackPriceCop,
  campaignCatalogPricing,
  formatMoneyInput,
  parseMoneyInput,
  parsePlanId,
  parseBillingPeriod,
  quotePlan,
  quotePlanWithDiscount,
  quoteUsageOverage,
  planNewCustomersLimit,
  planSmsReachLimit,
  planIncludesPhysicalKit,
  planHasGpsProximity,
  addBillingDays,
  initialBillingIntervalDays,
  initialNextBillingAt,
  advanceNextBillingAt,
  initialNextUsageBillingAt,
  advanceNextUsageBillingAt,
  usagePeriodFor,
  formatChargeDate,
  subscriptionCalendar,
  subscriptionChargeDates,
} from './pricing';

export {
  COLOMBIA_DEPARTMENTS,
  colombiaDepartmentNames,
  municipalitiesOf,
  isColombiaMunicipality,
  formatColombiaCity,
  isColombiaCity,
  filterMunicipalities,
  matchColombiaMunicipality,
  foldColombiaName,
  type ColombiaDepartment,
} from './colombia-geo';

export {
  SUCCESS_WINDOW_DAYS,
  SUCCESS_RATE_THRESHOLD,
  successWindowDays,
  campaignWorked,
  successLabel,
  computeRoiRatio,
} from './campaign-metrics';
