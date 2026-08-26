'use client';

import type { CSSProperties } from 'react';

/** Bloque base de skeleton (pulso suave sobre el gris de marca). */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--onda-border)]/55 ${className}`.trim()}
      style={style}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`.trim()} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`}
          style={
            i === lines - 1 && lines > 1
              ? { width: '66%' }
              : i % 2 === 1
                ? { width: '88%' }
                : undefined
          }
        />
      ))}
    </div>
  );
}

export function SkeletonKpiRow({
  count = 4,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  const lgCols =
    count >= 5 ? 'lg:grid-cols-5' : count === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 ${lgCols} ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={`onda-card overflow-hidden ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[var(--onda-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-3 ${c === 0 ? 'w-24' : c === cols - 1 ? 'w-12' : 'w-16'} flex-1`}
                style={{ maxWidth: c === 0 ? 140 : 96 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({
  rows = 4,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul
      className={`space-y-3 ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4"
        >
          <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" style={{ width: '55%' }} />
            <Skeleton className="h-3 w-1/3" style={{ width: '35%' }} />
          </div>
          <Skeleton className="h-5 w-14 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonCards({
  count = 6,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="onda-card overflow-hidden p-0"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-1/2" style={{ width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetail({ className = '' }: { className?: string }) {
  return (
    <div
      className={`space-y-5 ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <SkeletonKpiRow count={4} />
      <div className="onda-card space-y-3 p-5">
        <Skeleton className="h-4 w-40" />
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}

/** Pantalla completa (auth / shell). */
export function SkeletonScreen({
  label = 'Cargando',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center gap-4 p-6 ${className}`.trim()}
      aria-busy="true"
      aria-label={label}
    >
      <Skeleton className="h-10 w-28 rounded-2xl" />
      <div className="w-full max-w-xs space-y-3">
        <Skeleton className="mx-auto h-3 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="mx-auto h-3 w-28" />
      </div>
    </div>
  );
}

/** Resumen analytics / POS: KPIs + bloques de gráficas. */
export function SkeletonDashboard({
  kpis = 4,
  className = '',
}: {
  kpis?: number;
  className?: string;
}) {
  return (
    <div
      className={`space-y-6 ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      <SkeletonKpiRow count={kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

/** PWA: cabecera + tarjeta / lista. */
export function SkeletonPwa({ className = '' }: { className?: string }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-lg flex-col gap-4 p-4 ${className}`.trim()}
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="flex justify-center">
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="mx-auto h-48 w-full max-w-sm rounded-[1.5rem]" />
      <SkeletonText lines={2} className="mx-auto max-w-xs" />
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}
