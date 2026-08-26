'use client';

import { motion } from 'framer-motion';
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CashRegisterIcon as CashRegister } from '@phosphor-icons/react/dist/csr/CashRegister';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { fadeUpDelay, inViewStagger, staggerItem } from '../lib/motion';
import { SHOW_POS_LANDING } from '../lib/pricing';

const ALL_PILLARS = [
  {
    id: 'lealtad',
    icon: Gift,
    label: 'Lealtad',
    title: 'El cliente vuelve por el premio',
    bullets: [
      'Pase en Apple y Google Wallet — sin app',
      'Ondas: progreso claro hacia la recompensa',
      'Tú defines el premio y las reglas',
    ],
    href: '#demo',
    cta: 'Ver la experiencia',
  },
  {
    id: 'pos',
    icon: CashRegister,
    label: 'POS',
    title: 'Cobra y controla el día a día',
    bullets: [
      'Cuentas abiertas, también anónimas',
      'Catálogo e inventario sencillos',
      'Ondas opcionales al cobrar',
    ],
    href: '#pos',
    cta: 'Conocer el POS',
  },
] as const;

export function ProductPillarsSection() {
  const pillars = SHOW_POS_LANDING
    ? ALL_PILLARS
    : ALL_PILLARS.filter((p) => p.id !== 'pos');

  return (
    <section id="producto" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <motion.div {...inViewStagger} className="mx-auto max-w-2xl text-center">
        <motion.h2
          variants={staggerItem}
          className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]"
        >
          {SHOW_POS_LANDING
            ? 'Un solo producto. Dos motores.'
            : 'Lealtad que hace volver'}
        </motion.h2>
        <motion.p variants={staggerItem} className="mt-3 text-lg text-[var(--onda-muted)]">
          {SHOW_POS_LANDING
            ? 'Lealtad que hace volver al cliente y un POS para vender sin fricción — conectados cuando quieres.'
            : 'Ondas en Wallet para que el cliente vuelva por el premio — sin app que descargar.'}
        </motion.p>
      </motion.div>

      <div
        className={`mt-12 grid gap-5 ${
          pillars.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-xl md:grid-cols-1'
        }`}
      >
        {pillars.map((pillar, i) => {
          const Icon = pillar.icon;
          return (
            <motion.article
              key={pillar.id}
              {...fadeUpDelay(0.06 + i * 0.06)}
              className="flex flex-col rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-6 shadow-[0_12px_32px_rgba(26,27,46,0.06)] md:p-8"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                <Icon size={22} weight="regular" />
              </span>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-primary-500)]">
                {pillar.label}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--onda-ink)] md:text-2xl">
                {pillar.title}
              </h3>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[var(--onda-muted)]">
                {pillar.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--onda-primary-500)]"
                      aria-hidden
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={pillar.href}
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--onda-primary-500)] transition hover:text-[var(--onda-primary-600)]"
              >
                {pillar.cta}
                <ArrowRight size={16} weight="bold" />
              </a>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
