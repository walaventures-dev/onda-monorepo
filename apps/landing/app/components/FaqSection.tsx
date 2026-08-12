'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { PLAN_ONDA_MONTHLY_LIMIT, PLAN_SMS_CAMPAIGNS_MONTHLY } from '@onda/shared-types';
import { easeOut, fadeUpDelay, inViewStagger, staggerItem } from '../lib/motion';

const FAQS = [
  {
    q: '¿Mis clientes necesitan descargar una app?',
    a: 'No. El pase vive en Apple Wallet o Google Wallet. Lo agregan una vez y lo usan en cada visita — sin instalar nada nuevo.',
  },
  {
    q: '¿Cómo acumulan Ondas mis clientes?',
    a: 'Con el Kit NFC + QR o desde el panel. Cada visita o compra suma progreso hacia la recompensa que tú defines. Ellos ven el avance en el pase; tú controlas las reglas.',
  },
  {
    q: '¿Qué incluye el Kit?',
    a: 'En planes de 6 o 12 meses te enviamos el Kit a tu negocio con NFC y QR listos para usar. En el plan mensual la activación es digital; el Kit está disponible al pasar a 6 o 12 meses.',
  },
  {
    q: '¿Cuánto tarda poner Onda en mi negocio?',
    a: 'Puedes activarte en minutos: eliges plan, configuras tu recompensa y empiezas. El Kit físico llega después de tu primer pago en los periodos de 6 o 12 meses.',
  },
  {
    q: '¿Cuál es la diferencia entre Onda y Onda Pro?',
    a: `Ambos planes incluyen hasta ${PLAN_ONDA_MONTHLY_LIMIT} ondas al mes y ${PLAN_SMS_CAMPAIGNS_MONTHLY} campañas SMS gratis. Onda te da el pase en Wallet, recompensas a tu medida y avisos push. Onda Pro suma campañas para traer clientes de vuelta, avisos de proximidad, reseñas en Google y analítica.`,
  },
  {
    q: '¿Qué cubre la suscripción cada mes?',
    a: `Hasta ${PLAN_ONDA_MONTHLY_LIMIT} ondas acumuladas por tus clientes y ${PLAN_SMS_CAMPAIGNS_MONTHLY} campañas SMS. Si llegas al tope, la acumulación se pausa hasta el siguiente mes. El push de Wallet no cuenta contra ese cupo de SMS.`,
  },
  {
    q: '¿El primer mes es gratis de verdad?',
    a: 'Sí. Todos los planes incluyen el primer mes gratis y no necesitas tarjeta de crédito para iniciar. En 6 o 12 meses el mes gratis va adicional al descuento del prepago.',
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...inViewStagger} className="mx-auto max-w-2xl text-center">
        <motion.h2
          variants={staggerItem}
          className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]"
        >
          Preguntas frecuentes
        </motion.h2>
        <motion.p variants={staggerItem} className="mt-3 text-lg text-[var(--onda-muted)]">
          Lo esencial antes de poner tu negocio en la Onda.
        </motion.p>
      </motion.div>

      <motion.div
        {...fadeUpDelay(0.08)}
        className="mx-auto mt-10 max-w-2xl divide-y divide-[var(--onda-border)] overflow-hidden rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_8px_24px_rgba(26,27,46,0.06)]"
      >
        {FAQS.map((item, i) => {
          const open = openIndex === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;

          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--onda-primary-50)]/60 md:px-6 md:py-5"
                >
                  <span className="font-display text-base font-semibold tracking-tight text-[var(--onda-ink)] md:text-lg">
                    {item.q}
                  </span>
                  <CaretDown
                    size={18}
                    weight="regular"
                    aria-hidden
                    className={`shrink-0 text-[var(--onda-muted)] transition-transform duration-200 ${
                      open ? 'rotate-180 text-[var(--onda-primary-500)]' : ''
                    }`}
                  />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--onda-muted)] md:px-6 md:pb-6 md:text-base">
                      {item.a}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
