'use client';

/** Lightweight heatmap points list — Leaflet map can wrap this when token/CDN available */
export function HeatmapPoints({
  points,
}: {
  points: Array<{ lat: number; lng: number; name: string; weight?: number }>;
}) {
  return (
    <div className="space-y-2">
      {points.map((p, i) => (
        <div
          key={`${p.lat}-${p.lng}-${i}`}
          className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate font-medium">{p.name}</span>
          <span className="shrink-0 text-[var(--onda-sky)]">
            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            {p.weight != null ? ` · ${p.weight}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
