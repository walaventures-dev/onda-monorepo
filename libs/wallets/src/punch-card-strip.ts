import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { normalizeHexColor } from './colors';

/** WalletWallet recomienda 1080×360 para `stripURL` (store card). */
const STRIP_W = 1080;
const STRIP_H = 360;
/** Altura del banner opcional encima de los sellos (~38% del strip). */
const BANNER_H = 138;

type Rgb = { r: number; g: number; b: number };

type Slot = {
  cx: number;
  cy: number;
  r: number;
  filled: boolean;
};

const stripCache = new Map<string, string>();
let handPng: Buffer | null | undefined;

function parseRgb(hex: string): Rgb {
  const normalized = normalizeHexColor(hex) ?? '#FFFFFF';
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function isLightRgb(rgb: Rgb) {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 180;
}

/** Misma grilla que `PunchCardGrid` en la PWA. */
export function punchCardColumns(maxStamps: number) {
  const n = Math.max(1, Math.min(12, Math.round(maxStamps) || 12));
  if (n <= 4) return n;
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  if (n <= 10) return 5;
  return 6;
}

function resolveHandPng(): Buffer | null {
  if (handPng !== undefined) return handPng;
  const candidates = [
    join(__dirname, '../../shared/ui/assets/brand/onda-hand.png'),
    join(process.cwd(), 'libs/shared/ui/assets/brand/onda-hand.png'),
    join(process.cwd(), 'apps/pwa-client/public/brand/onda-hand.png'),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      handPng = readFileSync(file);
      return handPng;
    }
  }
  handPng = null;
  return null;
}

function layoutSlots(
  maxStamps: number,
  points: number,
  area: { top: number; height: number }
): { n: number; slots: Slot[] } {
  const n = Math.max(1, Math.min(12, Math.round(maxStamps) || 12));
  const filledCount = Math.max(0, Math.min(n, Math.floor(points)));
  const cols = punchCardColumns(n);
  const rows = Math.ceil(n / cols);
  const gap = 18;
  const innerW = STRIP_W * 0.88;
  const innerH = area.height * 0.86;
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const cellH = (innerH - gap * (rows - 1)) / rows;
  const cell = Math.min(cellW, cellH);
  const gridW = cols * cell + gap * (cols - 1);
  const gridH = rows * cell + gap * (rows - 1);
  const originX = (STRIP_W - gridW) / 2;
  const originY = area.top + (area.height - gridH) / 2;
  const r = cell * 0.42;

  const slots = Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      cx: originX + col * (cell + gap) + cell / 2,
      cy: originY + row * (cell + gap) + cell / 2,
      r,
      filled: i < filledCount,
    };
  });

  return { n, slots };
}

function circlesSvg(backgroundHex: string, fg: Rgb, slots: Slot[]): string {
  const ink = (alpha: number) => `rgba(${fg.r},${fg.g},${fg.b},${alpha})`;
  const circles = slots
    .map((slot) =>
      slot.filled
        ? `<circle cx="${slot.cx.toFixed(1)}" cy="${slot.cy.toFixed(1)}" r="${slot.r.toFixed(1)}" fill="${ink(0.16)}"/>`
        : `<circle cx="${slot.cx.toFixed(1)}" cy="${slot.cy.toFixed(1)}" r="${slot.r.toFixed(1)}" fill="${ink(0.05)}" stroke="${ink(0.28)}" stroke-width="3"/>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${STRIP_H}" viewBox="0 0 ${STRIP_W} ${STRIP_H}">
  <rect width="${STRIP_W}" height="${STRIP_H}" fill="${backgroundHex}"/>
  ${circles}
</svg>`;
}

async function tintedHand(size: number, fg: Rgb, opacity: number): Promise<Buffer | null> {
  const source = resolveHandPng();
  if (!source) return null;

  const sharp = (await import('sharp')).default;
  let img = sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha();

  if (isLightRgb(fg)) {
    img = img.tint({ r: 255, g: 255, b: 255 });
  } else {
    img = img.tint(fg);
  }

  const png = await img.png().toBuffer();
  if (opacity >= 0.99) return png;

  return sharp(png)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="white" fill-opacity="${opacity}"/></svg>`
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  return Boolean(
    url && (url.startsWith('https://') || url.startsWith('data:image/'))
  );
}

async function loadBannerBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('data:image/')) {
      const comma = url.indexOf(',');
      if (comma < 0) return null;
      return Buffer.from(url.slice(comma + 1), 'base64');
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * PNG data URI de la cartilla (manos llenas/vacías) para `stripURL` de WalletWallet.
 * Si hay `bannerUrl`, se coloca un banner horizontal arriba de los sellos.
 * Devuelve null si no se puede rasterizar (p.ej. sin `sharp`).
 */
export async function buildPunchCardStripDataUri(input: {
  points: number;
  maxStamps: number;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  /** Banner horizontal opcional (HTTPS o data URI) encima de los sellos. */
  bannerUrl?: string | null;
}): Promise<string | null> {
  const backgroundHex = normalizeHexColor(input.backgroundColor) ?? '#052DDE';
  const fg = parseRgb(input.foregroundColor || '#FFFFFF');
  const bannerUrl = isUsableImageUrl(input.bannerUrl) ? input.bannerUrl : null;
  const filled = Math.max(0, Math.min(Math.round(input.maxStamps || 12), Math.floor(input.points)));
  const cacheKey = `${Math.round(input.maxStamps || 12)}|${filled}|${backgroundHex}|${fg.r},${fg.g},${fg.b}|${bannerUrl || ''}`;
  const cached = stripCache.get(cacheKey);
  if (cached) return cached;

  try {
    const sharp = (await import('sharp')).default;
    const bannerBuffer = bannerUrl ? await loadBannerBuffer(bannerUrl) : null;
    const hasBanner = Boolean(bannerBuffer);
    const stampArea = hasBanner
      ? { top: BANNER_H, height: STRIP_H - BANNER_H }
      : { top: 0, height: STRIP_H };

    const { slots } = layoutSlots(input.maxStamps, input.points, stampArea);
    const base = await sharp(Buffer.from(circlesSvg(backgroundHex, fg, slots)))
      .png({ compressionLevel: 9 })
      .toBuffer();

    const handSize = Math.max(18, Math.round((slots[0]?.r ?? 40) * 1.35));
    const [filledHand, emptyHand] = await Promise.all([
      tintedHand(handSize, fg, 1),
      tintedHand(handSize, fg, 0.22),
    ]);

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];

    if (bannerBuffer) {
      const bannerPng = await sharp(bannerBuffer)
        .resize(STRIP_W, BANNER_H, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      composites.push({ input: bannerPng, left: 0, top: 0 });
    }

    if (filledHand && emptyHand) {
      for (const slot of slots) {
        composites.push({
          input: slot.filled ? filledHand : emptyHand,
          left: Math.round(slot.cx - handSize / 2),
          top: Math.round(slot.cy - handSize / 2),
        });
      }
    }

    const png = await sharp(base).composite(composites).png({ compressionLevel: 9 }).toBuffer();
    const dataUri = `data:image/png;base64,${png.toString('base64')}`;
    if (stripCache.size > 80) stripCache.clear();
    stripCache.set(cacheKey, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}
