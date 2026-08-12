'use client';

import { ReactLenis, useLenis } from 'lenis/react';
import { useEffect, type ReactNode } from 'react';
import 'lenis/dist/lenis.css';

const HEADER_OFFSET = 88;

function AnchorInterceptor() {
  const lenis = useLenis();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const hash = anchor.getAttribute('href');
      if (!hash || hash === '#') return;
      const el = document.querySelector(hash);
      if (!(el instanceof HTMLElement)) return;

      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

      if (lenis) {
        lenis.scrollTo(top, { duration: 1.2 });
      } else {
        window.scrollTo({ top, behavior: 'smooth' });
      }
      history.pushState(null, '', hash);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [lenis]);

  return null;
}

function ReducedMotionSync() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mq.matches) lenis.stop();
      else lenis.start();
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [lenis]);

  return null;
}

/**
 * Scroll con inercia (Lenis) + anclas suaves al header sticky.
 * Respeta prefers-reduced-motion.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.35,
        autoRaf: true,
      }}
    >
      <ReducedMotionSync />
      <AnchorInterceptor />
      {children}
    </ReactLenis>
  );
}
