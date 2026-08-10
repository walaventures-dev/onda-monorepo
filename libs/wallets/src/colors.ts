import type { ColorPreset } from './types';

type Rgb = { r: number; g: number; b: number };

const PRESET_RGB: Record<ColorPreset, Rgb> = {
  dark: { r: 28, g: 28, b: 30 },
  blue: { r: 30, g: 64, b: 175 },
  green: { r: 22, g: 163, b: 74 },
  red: { r: 220, g: 38, b: 38 },
  purple: { r: 110, g: 90, b: 230 },
  orange: { r: 234, g: 88, b: 12 },
};

function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function distance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Mapea un hex de marca al preset más cercano (plan free). */
export function nearestColorPreset(hex: string, fallback: ColorPreset = 'blue'): ColorPreset {
  const rgb = parseHex(hex);
  if (!rgb) return fallback;

  let best: ColorPreset = fallback;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [preset, value] of Object.entries(PRESET_RGB) as [ColorPreset, Rgb][]) {
    const d = distance(rgb, value);
    if (d < bestDist) {
      bestDist = d;
      best = preset;
    }
  }
  return best;
}

export function normalizeHexColor(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}
