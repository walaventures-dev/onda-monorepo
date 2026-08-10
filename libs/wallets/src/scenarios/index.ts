import type { PassScenarioId, PassSpec } from '../types';
import { buildCouponPassSpec, couponPassBuilder, type CouponPassContext } from './coupon';
import {
  buildEventTicketPassSpec,
  eventTicketPassBuilder,
  type EventTicketPassContext,
} from './event-ticket';
import { buildLoyaltyPassSpec, loyaltyPassBuilder, type LoyaltyPassContext } from './loyalty';
import { buildOndaCardPassSpec, ondaCardPassBuilder, type OndaCardPassContext } from './onda-card';
import type { PassScenarioBuilder } from './types';

export type { PassDesignInput, BaseLoyaltyContext, PassScenarioBuilder } from './types';
export type { LoyaltyPassContext } from './loyalty';
export type { OndaCardPassContext } from './onda-card';
export type { CouponPassContext } from './coupon';
export type { EventTicketPassContext } from './event-ticket';

export {
  buildLoyaltyPassSpec,
  loyaltyPassBuilder,
  buildOndaCardPassSpec,
  ondaCardPassBuilder,
  buildCouponPassSpec,
  couponPassBuilder,
  buildEventTicketPassSpec,
  eventTicketPassBuilder,
};

export type ScenarioContextMap = {
  loyalty: LoyaltyPassContext;
  'onda-card': OndaCardPassContext;
  coupon: CouponPassContext;
  'event-ticket': EventTicketPassContext;
};

const builders = {
  loyalty: loyaltyPassBuilder,
  'onda-card': ondaCardPassBuilder,
  coupon: couponPassBuilder,
  'event-ticket': eventTicketPassBuilder,
} as const satisfies {
  [K in PassScenarioId]: PassScenarioBuilder<ScenarioContextMap[K]>;
};

export function getScenarioBuilder<K extends PassScenarioId>(
  id: K
): PassScenarioBuilder<ScenarioContextMap[K]> {
  return builders[id] as PassScenarioBuilder<ScenarioContextMap[K]>;
}

/** Punto único para construir un PassSpec por escenario. */
export function buildPassSpec<K extends PassScenarioId>(
  scenario: K,
  ctx: ScenarioContextMap[K],
  opts?: { proFeatures?: boolean }
): PassSpec {
  switch (scenario) {
    case 'loyalty':
      return buildLoyaltyPassSpec(ctx as LoyaltyPassContext, opts);
    case 'onda-card':
      return buildOndaCardPassSpec(ctx as OndaCardPassContext, opts);
    case 'coupon':
      return buildCouponPassSpec(ctx as CouponPassContext, opts);
    case 'event-ticket':
      return buildEventTicketPassSpec(ctx as EventTicketPassContext, opts);
    default: {
      const _exhaustive: never = scenario;
      throw new Error(`Unknown wallet scenario: ${_exhaustive}`);
    }
  }
}
