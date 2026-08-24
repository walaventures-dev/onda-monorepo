/**
 * Logos de comercio con esquinas redondeadas (PNG + alpha).
 * Apple/Google Wallet no aplican CSS `border-radius`, así que el radio va en la imagen.
 */

const DEFAULT_SIZE = 512;
/** ~rounded-xl en un avatar ~44px (12/44 ≈ 0.27). */
const DEFAULT_RADIUS_RATIO = 0.22;

const logoCache = new Map<string, string>();

function isUsableImageUrl(url: string | null | undefined): url is string {
  return Boolean(
    url && (url.startsWith('https://') || url.startsWith('data:image/'))
  );
}

async function loadImageBuffer(url: string): Promise<Buffer | null> {
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
 * Recorta a cuadrado y aplica máscara de esquinas redondeadas → PNG.
 */
export async function roundLogoPng(
  input: Buffer,
  opts?: { size?: number; radiusRatio?: number }
): Promise<Buffer> {
  const size = opts?.size ?? DEFAULT_SIZE;
  const radius = Math.max(1, Math.round(size * (opts?.radiusRatio ?? DEFAULT_RADIUS_RATIO)));
  const sharp = (await import('sharp')).default;

  const squared = await sharp(input)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`
  );

  return sharp(squared)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Devuelve data URI PNG redondeado, o null si no se pudo procesar.
 */
export async function roundLogoDataUri(
  url: string | null | undefined
): Promise<string | null> {
  if (!isUsableImageUrl(url)) return null;

  const cached = logoCache.get(url);
  if (cached) return cached;

  const raw = await loadImageBuffer(url);
  if (!raw) return null;

  try {
    const png = await roundLogoPng(raw);
    const dataUri = `data:image/png;base64,${png.toString('base64')}`;
    if (logoCache.size > 80) logoCache.clear();
    logoCache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}
