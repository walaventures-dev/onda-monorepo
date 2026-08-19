'use client';

import React from 'react';

/**
 * Contenedor que anima su altura al abrir/cerrar (grid 0fr → 1fr, sin medir con JS).
 * El contenido se mantiene montado, por eso queda `inert` mientras está cerrado.
 */
export function Collapsible({
  open,
  id,
  className = '',
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
