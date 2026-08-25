'use client';

import type { ReactNode } from 'react';
import { OndaIcons } from './icons';
import { PROMO_TYPE_OPTIONS, promoTypeLabel } from './AnalyticsFilters';

export type TxKind = 'ACCUMULATE' | 'REDEEM' | string;

export type TxActivityItem = {
  id: string;
  type: TxKind;
  points?: number;
  time: string;
  /** Nombre del cliente (auditoría) */
  person?: string | null;
  paymentAmount?: number | null;
  benefitAmount?: number | null;
  promotion?: {
    title?: string | null;
    type?: string | null;
  } | null;
};

export function promoTypeIcon(type?: string | null): ReactNode {
  return (
    PROMO_TYPE_OPTIONS.find((o) => o.id === type)?.icon || OndaIcons.other
  );
}

export function TxTypeBadge({ type }: { type: TxKind }) {
  const isAcc = type === 'ACCUMULATE';
  return (
    <span className={`onda-tx-badge ${isAcc ? 'is-acc' : 'is-redeem'}`}>
      {isAcc ? 'Acumulación' : 'Redención'}
    </span>
  );
}

export function PromoTypeChip({ type }: { type?: string | null }) {
  if (!type) return null;
  return (
    <span className="onda-promo-type-chip">
      <span className="onda-promo-type-chip-icon" aria-hidden>
        {promoTypeIcon(type)}
      </span>
      {promoTypeLabel(type)}
    </span>
  );
}

export function TxActivityRow({
  item,
  dense = false,
}: {
  item: TxActivityItem;
  dense?: boolean;
}) {
  const isAcc = item.type === 'ACCUMULATE';
  const points = item.points ?? (isAcc ? 1 : 0);
  const promoTitle = item.promotion?.title?.trim();
  const promoType = item.promotion?.type;

  return (
    <li className={`onda-tx-row${dense ? ' is-dense' : ''}`}>
      <div
        className={`onda-tx-dot ${isAcc ? 'is-acc' : 'is-redeem'}`}
        aria-hidden
      >
        {isAcc ? OndaIcons.accumulate : OndaIcons.redeem}
      </div>
      <div className="onda-tx-body">
        <div className="onda-tx-top">
          <TxTypeBadge type={item.type} />
          {!isAcc && promoType ? <PromoTypeChip type={promoType} /> : null}
        </div>
        <p className="onda-tx-detail">
          {item.person ? (
            <>
              <span className="onda-tx-person">{item.person}</span>
              {isAcc ? (
                <span className="onda-tx-muted"> · acumulación</span>
              ) : promoTitle ? (
                <span className="onda-tx-muted"> · {promoTitle}</span>
              ) : (
                <span className="onda-tx-muted"> · redención</span>
              )}
            </>
          ) : isAcc ? (
            <span className="onda-tx-muted">Acumulación al pase</span>
          ) : promoTitle ? (
            <span className="onda-tx-title">{promoTitle}</span>
          ) : (
            <span className="onda-tx-muted">Redención sin título</span>
          )}
        </p>
        <p className="onda-tx-time">{item.time}</p>
        {isAcc && item.paymentAmount != null && item.paymentAmount > 0 ? (
          <p className="onda-tx-muted text-xs">
            Cuenta ${item.paymentAmount.toLocaleString('es-CO')}
          </p>
        ) : null}
        {!isAcc && item.benefitAmount != null && item.benefitAmount > 0 ? (
          <p className="onda-tx-muted text-xs">
            Beneficio ${item.benefitAmount.toLocaleString('es-CO')}
          </p>
        ) : null}
      </div>
      <span className={`onda-tx-points ${isAcc ? 'is-acc' : 'is-redeem'}`}>
        {isAcc ? '+' : '−'}
        {points}
      </span>
    </li>
  );
}
