'use client';

import type { ReactNode } from 'react';

export function OndaIcon({
  children,
  className = 'h-3 w-3',
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={fill ? undefined : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const OndaIcons = {
  all: (
    <OndaIcon>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.5v5M5.5 8h5" />
    </OndaIcon>
  ),
  sparkle: (
    <OndaIcon>
      <path d="M8 2.5 9.2 6.2l3.8.3-2.9 2.5.9 3.7L8 10.8l-3 1.9.9-3.7-2.9-2.5 3.8-.3z" />
    </OndaIcon>
  ),
  users: (
    <OndaIcon>
      <circle cx="6" cy="6" r="2" />
      <path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13" />
      <circle cx="11" cy="6.5" r="1.6" />
      <path d="M10 9.5c1.4.3 2.5 1.4 2.5 3" />
    </OndaIcon>
  ),
  flame: (
    <OndaIcon>
      <path d="M8 13.5c2.2 0 3.5-1.5 3.5-3.5 0-2.2-1.8-3.4-2.4-5.2-.2 1.4-1 2.2-1.6 2.7-.3-1.6-1.2-2.8-2.5-3.5C5.5 6.2 4.5 8 4.5 10c0 2 1.3 3.5 3.5 3.5z" />
    </OndaIcon>
  ),
  target: (
    <OndaIcon>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </OndaIcon>
  ),
  alert: (
    <OndaIcon>
      <path d="M8 2.5 14 13H2z" />
      <path d="M8 6.5v3.5M8 11.5h.01" />
    </OndaIcon>
  ),
  info: (
    <OndaIcon>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.2v3.6M8 5.2h.01" />
    </OndaIcon>
  ),
  crown: (
    <OndaIcon>
      <path d="M2.5 11.5h11l-1-7L9.5 7 8 3.5 6.5 7l-3-2.5z" />
      <path d="M3 11.5h10v1.5H3z" />
    </OndaIcon>
  ),
  moon: (
    <OndaIcon>
      <path d="M11.5 9.5A4.5 4.5 0 0 1 6.2 3.3 5 5 0 1 0 11.5 9.5z" />
    </OndaIcon>
  ),
  whatsapp: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.11 4.88A9.91 9.91 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.85-7.05zm-7.07 15.27h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.88 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.17-.48-.29z" />
    </svg>
  ),
  calendar: (
    <OndaIcon>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
    </OndaIcon>
  ),
  day: (
    <OndaIcon>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.85.85M11.05 11.05l.85.85M11.05 4.1l-.85.85M4.1 11.05l-.85.85" />
    </OndaIcon>
  ),
  week: (
    <OndaIcon>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5 9h1.2M7.4 9h1.2M9.8 9h1.2M5 11.2h1.2M7.4 11.2h1.2" />
    </OndaIcon>
  ),
  custom: (
    <OndaIcon>
      <path d="M3 11.5 10.5 4l2 2L5 13.5H3z" />
      <path d="M9.2 5.3l2 2" />
    </OndaIcon>
  ),
  percent: (
    <OndaIcon>
      <circle cx="5.5" cy="5.5" r="1.5" />
      <circle cx="10.5" cy="10.5" r="1.5" />
      <path d="M12 4 4 12" />
    </OndaIcon>
  ),
  dollar: (
    <OndaIcon>
      <path d="M8 2.5v11M10.5 5.2C10.5 4 9.4 3.5 8 3.5S5.5 4 5.5 5.2c0 2.5 5 1.3 5 4.1 0 1.3-1.2 2.2-2.5 2.2S5.5 10.6 5.5 9.5" />
    </OndaIcon>
  ),
  nXm: (
    <OndaIcon>
      <path d="M3.5 5.5h3v5h-3zM9.5 5.5h3v5h-3zM7.2 8h1.6" />
    </OndaIcon>
  ),
  product: (
    <OndaIcon>
      <path d="M2.5 5.5 8 2.5l5.5 3v7L8 13.5l-5.5-3z" />
      <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" />
    </OndaIcon>
  ),
  other: (
    <OndaIcon>
      <circle cx="4" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </OndaIcon>
  ),
  download: (
    <OndaIcon>
      <path d="M8 2.5v8M5 8l3 3 3-3M3 13h10" />
    </OndaIcon>
  ),
  plus: (
    <OndaIcon>
      <path d="M8 3.5v9M3.5 8h9" />
    </OndaIcon>
  ),
  edit: (
    <OndaIcon>
      <path d="M3 11.5 10.5 4l2 2L5 13.5H3z" />
      <path d="M9.2 5.3l2 2" />
    </OndaIcon>
  ),
  copy: (
    <OndaIcon>
      <rect x="5.5" y="5.5" width="7" height="8" rx="1" />
      <path d="M3.5 10.5V3.5h7" />
    </OndaIcon>
  ),
  power: (
    <OndaIcon>
      <path d="M8 2.5v5.5M4.8 4.2a5 5 0 1 0 6.4 0" />
    </OndaIcon>
  ),
  trash: (
    <OndaIcon>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8.5h5l.5-8.5" />
    </OndaIcon>
  ),
  check: (
    <OndaIcon>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </OndaIcon>
  ),
  lock: (
    <OndaIcon>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </OndaIcon>
  ),
  globe: (
    <OndaIcon>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c1.8 1.8 2.8 3.6 2.8 5.5S9.8 11.7 8 13.5C6.2 11.7 5.2 9.9 5.2 8S6.2 4.3 8 2.5z" />
    </OndaIcon>
  ),
  ticket: (
    <OndaIcon>
      <path d="M2.5 5.5h11v2a1.5 1.5 0 0 0 0 3v2h-11v-2a1.5 1.5 0 0 0 0-3z" />
      <path d="M6 5.5v7" />
    </OndaIcon>
  ),
  accumulate: (
    <OndaIcon>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v6M5 8h6" />
    </OndaIcon>
  ),
  redeem: (
    <OndaIcon>
      <path d="M2.5 8.5 8.5 2.5h4v4L6.5 12.5z" />
      <circle cx="11" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </OndaIcon>
  ),
  save: (
    <OndaIcon>
      <path d="M3.5 3.5h7.5L12.5 5v7.5h-9z" />
      <path d="M5 3.5v3h5v-3M5 12.5v-3.5h6V12.5" />
    </OndaIcon>
  ),
  eye: (
    <OndaIcon>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </OndaIcon>
  ),
  close: (
    <OndaIcon>
      <path d="M4 4l8 8M12 4 4 12" />
    </OndaIcon>
  ),
  near: (
    <OndaIcon>
      <path d="M8 13.5S3.5 10 3.5 6.8A4.5 4.5 0 0 1 8 2.5a4.5 4.5 0 0 1 4.5 4.3C12.5 10 8 13.5 8 13.5z" />
      <circle cx="8" cy="6.8" r="1.4" />
    </OndaIcon>
  ),
  upgrade: (
    <OndaIcon>
      <path d="M8 12.5V4.5M5 7l3-3 3 3" />
      <path d="M3.5 12.5h9" />
    </OndaIcon>
  ),
  chart: (
    <OndaIcon>
      <path d="M3 13V8.5M6.5 13V5M10 13V7.5M13 13V3.5" />
    </OndaIcon>
  ),
  activity: (
    <OndaIcon>
      <path d="M2.5 8h2.5l1.5-3.5L9 12l2-4.5L12.5 8H13.5" />
    </OndaIcon>
  ),
  gear: (
    <OndaIcon>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 2.5v1.4M8 12.1v1.4M2.5 8h1.4M12.1 8h1.4M4.1 4.1l1 .95M10.95 10.95l1 .95M11.9 4.1l-1 .95M5.05 10.95l-1 .95" />
    </OndaIcon>
  ),
  pass: (
    <OndaIcon>
      <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
      <path d="M2.5 7h11M5 10h3" />
    </OndaIcon>
  ),
  panelLeft: (
    <OndaIcon>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M6 3v10" />
    </OndaIcon>
  ),
  chevronLeft: (
    <OndaIcon>
      <path d="M9.5 3.5 5 8l4.5 4.5" />
    </OndaIcon>
  ),
  chevronRight: (
    <OndaIcon>
      <path d="M6.5 3.5 11 8l-4.5 4.5" />
    </OndaIcon>
  ),
};

export function badgeIcon(badge?: string | null): ReactNode {
  switch (badge) {
    case 'Nuevo':
      return OndaIcons.sparkle;
    case 'Cerca':
      return OndaIcons.target;
    case 'En riesgo':
      return OndaIcons.alert;
    case 'Dormido':
      return OndaIcons.moon;
    case 'VIP':
      return OndaIcons.crown;
    case 'Top':
      return OndaIcons.sparkle;
    case 'Fría':
      return OndaIcons.moon;
    default:
      return OndaIcons.users;
  }
}

export function badgeDescription(badge?: string | null): string {
  switch (badge) {
    case 'Nuevo':
      return 'Se unió al programa en este periodo';
    case 'Cerca':
      return 'Le faltan pocas ondas para canjear una promoción';
    case 'En riesgo':
      return 'No visita hace un tiempo y podría dejar de venir';
    case 'Dormido':
      return 'No ha vuelto hace mucho tiempo';
    case 'VIP':
      return 'Está entre los clientes con más ondas acumuladas';
    case 'Top':
      return 'Es de las promociones con mejor desempeño';
    case 'Fría':
      return 'Es de las promociones con menos actividad';
    default:
      return '';
  }
}

export function BadgePill({
  badge,
  className = 'rounded-full bg-[var(--onda-violet-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-violet)]',
}: {
  badge: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={badgeDescription(badge)}
    >
      {badgeIcon(badge)}
      {badge}
    </span>
  );
}
