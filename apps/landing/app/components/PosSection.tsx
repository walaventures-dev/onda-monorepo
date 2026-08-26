'use client';

import { motion } from 'framer-motion';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { WavesIcon as Waves } from '@phosphor-icons/react/dist/csr/Waves';
import { fadeUpDelay, inViewStagger, staggerItem } from '../lib/motion';
import { PosPreview } from './mocks/PosPreview';

const FEATURES = [
  {
    icon: Receipt,
    title: 'Vender con cuentas abiertas',
    desc: 'Varias cuentas a la vez, con o sin cliente. Cobras en efectivo o transferencia y listo.',
  },
  {
    icon: Package,
    title: 'Inventario sencillo',
    desc: 'Catálogo con stock opcional. Sabes qué se vende y qué se acaba — sin Excel eterno.',
  },
  {
    icon: Waves,
    title: 'Ondas al cobrar',
    desc: 'Asocia el pase al checkout y suma Ondas. Si no hay cliente, la venta sigue igual.',
  },
] as const;

export function PosSection() {
  return (
    <section id="pos" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <motion.div {...inViewStagger}>
            <motion.p
              variants={staggerItem}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-primary-500)]"
            >
              Punto de venta
            </motion.p>
            <motion.h2
              variants={staggerItem}
              className="mt-3 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]"
            >
              La caja que también acumula Ondas.
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="mt-4 max-w-lg text-lg text-[var(--onda-muted)]"
            >
              Vende el día a día y, cuando quieras, conecta la lealtad en el mismo
              cobro. Roles Admin y Caja para tu equipo.
            </motion.p>
          </motion.div>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.li key={f.title} {...fadeUpDelay(0.08 + i * 0.06)} className="flex gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                    <Icon size={22} weight="regular" />
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold text-[var(--onda-ink)] md:text-lg">
                      {f.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--onda-muted)]">
                      {f.desc}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <motion.div {...fadeUpDelay(0.12)} className="relative">
          <div
            className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-60"
            style={{
              background:
                'radial-gradient(circle at 50% 40%, rgba(61,185,232,0.18), transparent 55%)',
            }}
          />
          <div className="relative">
            <PosPreview />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
