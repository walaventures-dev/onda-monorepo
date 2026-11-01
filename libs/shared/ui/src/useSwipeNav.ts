'use client';

import { useEffect, type RefObject } from 'react';

function insideHorizontalScroller(el: HTMLElement | null): boolean {
  let node = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 8
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function insideDialog(el: HTMLElement | null): boolean {
  let node = el;
  while (node && node !== document.body) {
    const role = node.getAttribute('role');
    if (role === 'dialog' || role === 'alertdialog') return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Navegación con swipe horizontal táctil estilo app:
 * desliza a la derecha = atrás, a la izquierda = adelante.
 *
 * El gesto se ignora si empieza dentro de un carrusel scrolleable
 * horizontalmente (p. ej. los salones de mesas), dentro de un diálogo
 * modal abierto, o si el movimiento es mayormente vertical, para no
 * pelear con el scroll ni navegar debajo de un modal.
 */
export function useSwipeNav(
  ref: RefObject<HTMLElement | null>,
  handlers: {
    onBack?: () => void;
    onForward?: () => void;
    enabled?: boolean;
  },
) {
  const { onBack, onForward, enabled = true } = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof window === 'undefined') return;
    if (!('ontouchstart' in window)) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startT = Date.now();
      tracking =
        !insideHorizontalScroller(e.target as HTMLElement | null) &&
        !insideDialog(e.target as HTMLElement | null);
    }

    function onTouchCancel() {
      tracking = false;
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 64) return;
      if (Math.abs(dx) < Math.abs(dy) * 2) return;
      if (Date.now() - startT > 600) return;
      if (dx > 0) onBack?.();
      else onForward?.();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [ref, onBack, onForward, enabled]);
}
