'use client';

import type { CSSProperties } from 'react';

export const ONDA_BRAND = {
  wordmark: '/brand/onda-wordmark.png',
  hand: '/brand/onda-hand.png',
  script: '/brand/onda-script.png',
  kitBienvenida: '/brand/onda-kit-bienvenida.png',
  addToAppleWallet: '/brand/add-to-apple-wallet.png',
  addToGoogleWallet: '/brand/add-to-google-wallet.png',
} as const;

export type OndaBrandVariant = 'default' | 'onDark' | 'onPrimary';

function variantFilter(variant: OndaBrandVariant): string | undefined {
  // Wordmark is blue; invert to white on dark/primary surfaces.
  // Hand/script are cream; invert (or blacken) for contrast on light surfaces.
  if (variant === 'onDark' || variant === 'onPrimary') return 'brightness-0 invert';
  return undefined;
}

export function OndaWordmark({
  className = '',
  variant = 'default',
  alt = 'Onda.',
  style,
}: {
  className?: string;
  variant?: OndaBrandVariant;
  alt?: string;
  style?: CSSProperties;
}) {
  const filter = variantFilter(variant);
  return (
      <img
      src={ONDA_BRAND.wordmark}
      alt={alt}
      className={`h-8 w-auto ${filter ?? ''} ${className}`.trim()}
      style={style}
      draggable={false}
    />
  );
}

export function OndaHandMark({
  className = '',
  variant = 'default',
  alt = '',
}: {
  className?: string;
  variant?: OndaBrandVariant;
  alt?: string;
}) {
  // Cream asset: on light → dark silhouette; on dark/primary → white.
  const filter =
    variant === 'onDark' || variant === 'onPrimary'
      ? 'brightness-0 invert'
      : 'brightness-0';
  return (
      <img
      src={ONDA_BRAND.hand}
      alt={alt}
      className={`h-8 w-auto ${filter} ${className}`.trim()}
      aria-hidden={alt ? undefined : true}
      draggable={false}
    />
  );
}

export function OndaScriptMark({
  className = '',
  variant = 'default',
  alt = '',
}: {
  className?: string;
  variant?: OndaBrandVariant;
  alt?: string;
}) {
  const filter =
    variant === 'onDark' || variant === 'onPrimary'
      ? 'brightness-0 invert'
      : 'brightness-0';
  return (
      <img
      src={ONDA_BRAND.script}
      alt={alt}
      className={`h-10 w-auto ${filter} ${className}`.trim()}
      aria-hidden={alt ? undefined : true}
      draggable={false}
    />
  );
}

export function OndaLogo({
  className = '',
  compact = false,
  variant = 'default',
}: {
  className?: string;
  compact?: boolean;
  variant?: OndaBrandVariant;
}) {
  if (compact) {
    return (
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--onda-primary-500)] ${className}`.trim()}
        aria-label="Onda"
      >
        <OndaHandMark variant="onPrimary" className="h-5 w-auto" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${className}`.trim()} aria-label="Onda">
      <OndaWordmark variant={variant} className="h-8 w-auto" />
    </span>
  );
}
