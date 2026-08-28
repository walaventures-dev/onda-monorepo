function pwaBaseUrl() {
  return (process.env.NEXT_PUBLIC_PWA_URL || 'http://localhost:4201').replace(
    /\/$/,
    ''
  );
}

export function buildFeedbackUrl(input: { slug: string; passId?: string }) {
  const key = encodeURIComponent(input.slug);
  const base = `${pwaBaseUrl()}/r/${key}/feedback`;
  if (input.passId) {
    return `${base}?pass=${encodeURIComponent(input.passId)}`;
  }
  return base;
}

export function buildFeedbackSms(storeName: string, url: string) {
  const trimmedName = storeName.trim().slice(0, 40);
  const msg = `¿Cómo estuvo en ${trimmedName}? Cuéntanos: ${url}`;
  return msg.slice(0, 160);
}

export function googleWriteReviewUrl(googlePlaceId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    googlePlaceId
  )}`;
}

export function googleMapsPlaceUrl(googlePlaceId: string) {
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(
    googlePlaceId
  )}`;
}
