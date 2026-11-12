'use client';

import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

const TRIGGER_PX = 48;
const HINT_MAX = 24;
const DEAD_ZONE = 8;

export type SwipeActionSpec = {
  key: string;
  label: string;
  icon: ReactNode;
  className: string;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * Swipe de fila estilo lista de chats: deslizar hacia la izquierda revela
 * una barra de acciones CONECTADA debajo de la fila (no la tapa, convive
 * con la información). Tocar una acción la ejecuta y cierra la barra;
 * deslizar a la derecha o tocar la fila la cierra. Funciona con touch y
 * mouse (Pointer Events).
 */
export function SwipeActions({
  actions,
  children,
  className,
}: {
  actions: SwipeActionSpec[];
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(0);
  const startRef = useRef({ x: 0, y: 0, pointerId: -1 });
  const lastDxRef = useRef(0);
  const suppressClickRef = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || startRef.current.pointerId !== -1) return;
    startRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    lastDxRef.current = 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* el pointer ya se liberó */
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== startRef.current.pointerId) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!dragging) {
      // Ignora gestos mayormente verticales para no pelear con el scroll.
      if (Math.abs(dy) > Math.abs(dx)) {
        startRef.current.pointerId = -1;
        return;
      }
      if (Math.abs(dx) < DEAD_ZONE) return;
      suppressClickRef.current = true;
      setDragging(true);
    }
    lastDxRef.current = dx;
    setHint(Math.max(-HINT_MAX, Math.min(HINT_MAX, dx * 0.35)));
  }

  function finish(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== startRef.current.pointerId) return;
    const wasDragging = dragging;
    const dx = lastDxRef.current;
    startRef.current.pointerId = -1;
    setDragging(false);
    setHint(0);
    if (!wasDragging) return;
    if (!open && dx <= -TRIGGER_PX) setOpen(true);
    else if (open && dx >= TRIGGER_PX) setOpen(false);
  }

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    // Tras arrastrar, el click de la fila debajo se ignora.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Con la barra abierta, tocar la fila solo la cierra.
    if (open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
        className="touch-pan-y"
        style={{
          transform: hint ? `translateX(${hint}px)` : undefined,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {children}
      </div>
      {open ? (
        <div className="onda-card -mt-2 rounded-t-none border-t-0 p-2 shadow-[0_8px_24px_rgba(26,27,46,0.06)]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={a.disabled}
                onClick={() => {
                  if (a.disabled) return;
                  setOpen(false);
                  a.onSelect();
                }}
                className={`flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${a.className}`}
              >
                {a.icon}
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
