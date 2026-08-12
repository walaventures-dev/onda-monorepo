import type { Transition, Variants } from 'framer-motion';

/** Curva principal: salida suave, sin rebote. */
export const easeOut = [0.22, 1, 0.36, 1] as const;
/** Un poco más “flotante” para hero / imagenes. */
export const easeSoft = [0.16, 1, 0.3, 1] as const;

export const viewportOnce = {
  once: true,
  amount: 0.22,
  margin: '0px 0px -6% 0px',
} as const;

const baseTransition: Transition = {
  duration: 0.7,
  ease: easeOut,
};

/** Reveal estándar al entrar en viewport (secciones). */
export const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: viewportOnce,
  transition: baseTransition,
};

export function fadeUpDelay(delay: number) {
  return {
    ...fadeUp,
    transition: { ...baseTransition, delay },
  };
}

/** Contenedor que escalona hijos con variants `hidden` / `show`. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeOut },
  },
};

export const staggerItemSoft: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeSoft },
  },
};

/** Props para un bloque que hace stagger al entrar en vista. */
export const inViewStagger = {
  variants: staggerContainer,
  initial: 'hidden' as const,
  whileInView: 'show' as const,
  viewport: viewportOnce,
};

export const inViewStaggerFast = {
  variants: staggerContainerFast,
  initial: 'hidden' as const,
  whileInView: 'show' as const,
  viewport: viewportOnce,
};

/** Hero: anima al montar (above the fold), no al scroll. */
export const heroMount = {
  variants: staggerContainer,
  initial: 'hidden' as const,
  animate: 'show' as const,
};

export const heroItem: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: easeSoft },
  },
};

export const heroVisual: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.9, ease: easeSoft, delay: 0.12 },
  },
};

export const crossfade: Transition = {
  duration: 0.28,
  ease: easeOut,
};
