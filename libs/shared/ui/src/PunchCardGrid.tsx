'use client';

import { ONDA_BRAND } from './brand';

function hexToRgb(hex: string) {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function isLightHex(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 180;
}

export function punchCardColumns(maxStamps: number) {
  const n = Math.max(1, Math.min(12, Math.round(maxStamps) || 12));
  if (n <= 4) return n;
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  if (n <= 10) return 5;
  return 6;
}

export function PunchCardGrid({
  points,
  maxStamps,
  milestoneStamps = [],
  foregroundColor = '#FFFFFF',
  size = 'md',
}: {
  points: number;
  maxStamps: number;
  milestoneStamps?: number[];
  foregroundColor?: string;
  size?: 'sm' | 'md';
}) {
  const n = Math.max(1, Math.min(12, Math.round(maxStamps) || 12));
  const cols = punchCardColumns(n);
  const lightForeground = isLightHex(foregroundColor);
  const stampInk = lightForeground
    ? 'rgba(255,255,255,'
    : (() => {
        const rgb = hexToRgb(foregroundColor);
        return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},` : 'rgba(47,79,70,';
      })();
  const cell = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const hand = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <div
      className="grid justify-items-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label="Punch card"
    >
      {Array.from({ length: n }, (_, i) => {
        const stampNumber = i + 1;
        const filled = stampNumber <= points;
        const hasMilestone = milestoneStamps.includes(stampNumber);
        return (
          <span
            key={stampNumber}
            className={`flex ${cell} items-center justify-center rounded-full`}
            style={
              filled
                ? { backgroundColor: `${stampInk}0.16)` }
                : {
                    backgroundColor: `${stampInk}0.05)`,
                    boxShadow: `inset 0 0 0 1.5px ${stampInk}0.28)`,
                  }
            }
            title={hasMilestone ? `Premio en el sello ${stampNumber}` : undefined}
            aria-label={
              filled ? `Onda ${stampNumber} acumulada` : `Ubicación ${stampNumber} vacía`
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ONDA_BRAND.hand}
              alt=""
              aria-hidden
              draggable={false}
              className={`${hand} object-contain brightness-0 ${lightForeground ? 'invert' : ''}`}
              style={{ opacity: filled ? 1 : 0.22 }}
            />
          </span>
        );
      })}
    </div>
  );
}
