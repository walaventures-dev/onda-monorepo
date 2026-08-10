'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';

/** Tries a product photo; falls back to composed CSS mock until the asset exists. */
export function ProductPhoto({
  src,
  alt,
  className = '',
  fallback,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  width: number;
  height: number;
  priority?: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: 'HEAD' })
      .then((r) => {
        if (!cancelled) setReady(r.ok);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!ready) return <>{fallback}</>;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      onError={() => setReady(false)}
    />
  );
}
