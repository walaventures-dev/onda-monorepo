'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DeviceMobileIcon as DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { MegaphoneIcon as Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { StarIcon as Star } from '@phosphor-icons/react/dist/csr/Star';
import { onboardingUrl } from '../lib/pricing';
import { fadeUp } from '../lib/motion';

const VALUE_POINTS = [
  { icon: DeviceMobile, title: 'Wallet', desc: 'Sin descargar app' },
  { icon: Gift, title: 'Recompensas', desc: 'Tú defines el premio' },
  { icon: Megaphone, title: 'Campañas', desc: 'Wallet, WhatsApp y SMS' },
  { icon: Star, title: 'Reseñas', desc: 'Más estrellas en Google' },
];

export function HeroSection() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 36]);

  return (
    <section ref={ref} className="relative overflow-hidden pb-8 pt-6 md:pb-16 md:pt-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(5,45,222,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(61,185,232,0.12), transparent 35%)',
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[1fr_1.05fr]">
        <motion.div {...fadeUp}>
          <h1 className="max-w-xl font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-[var(--onda-ink)]">
            Tu cliente se fue.{' '}
            <span className="text-[var(--onda-primary-500)]">Tu marca</span> no tiene por qué
            irse con él.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--onda-muted)]">
            Cada visita suma hacia un premio. Tú decides cuándo hacerlos volver —
            sin app que descargar.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {VALUE_POINTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-1.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                  <Icon size={20} weight="regular" />
                </span>
                <p className="text-sm font-semibold text-[var(--onda-ink)]">{title}</p>
                <p className="text-xs text-[var(--onda-muted)]">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col items-start gap-3">
            <a
              href={onboardingUrl()}
              className="inline-flex rounded-full bg-[var(--onda-primary-500)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
            >
              Poner mi negocio en la Onda →
            </a>
            <p className="text-sm text-[var(--onda-muted)]">
              Toma menos de 5 minutos empezar.
            </p>
          </div>
        </motion.div>

        <motion.div
          style={{ y: visualY }}
          className="relative mx-auto w-full max-w-xl"
          {...fadeUp}
        >
          <Image
            src="/product/hero.webp"
            alt="Pase Onda en Wallet junto al stand NFC y QR"
            width={1024}
            height={682}
            priority
            className="h-auto w-full scale-[1.04] object-contain drop-shadow-[0_28px_60px_rgba(26,27,46,0.2)] md:scale-110"
          />
        </motion.div>
      </div>
    </section>
  );
}
