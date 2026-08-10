'use client';

import { onboardingUrl } from '../lib/pricing';
import { fadeUp } from '../lib/motion';
import { NfcStand } from './mocks/NfcStand';
import { PhoneFrame } from './mocks/PhoneFrame';
import { ProductPhoto } from './ProductPhoto';
import { OndaHandMark } from '@onda/shared-ui';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DeviceMobileIcon as DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { MegaphoneIcon as Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { StarIcon as Star } from '@phosphor-icons/react/dist/csr/Star';

const VALUE_POINTS = [
  { icon: DeviceMobile, title: 'Wallet', desc: 'Sin apps' },
  { icon: Gift, title: 'Recompensas', desc: 'A tu manera' },
  { icon: Megaphone, title: 'Campañas', desc: 'Omnicanal' },
  { icon: Star, title: 'Google Reviews', desc: 'Más reputación' },
];

function HeroPhoneScreen() {
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#052DDE_0%,#081C91_100%)] px-4 pb-5 pt-10 text-white">
      <p className="text-xs font-medium text-white/70">Café Central</p>
      <p className="mt-1 font-display text-lg font-semibold">Tu tarjeta</p>
      <div className="mt-5 flex-1 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/60">Ondas</p>
            <p className="font-display text-4xl font-bold">4</p>
          </div>
          <svg width="48" height="28" viewBox="0 0 48 28" fill="none" className="opacity-90">
            <path
              d="M2 20c6-10 14-10 20 0s14 10 20 0"
              stroke="#3DB9E8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M2 14c6-10 14-10 20 0s14 10 20 0"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-4/5 rounded-full bg-[var(--onda-sky)]" />
        </div>
        <p className="mt-2 text-[10px] text-white/70">1 onda más → café gratis</p>
      </div>
    </div>
  );
}

export function HeroSection() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 48]);
  const standY = useTransform(scrollYProgress, [0, 1], [0, 20]);
  const handY = useTransform(scrollYProgress, [0, 1], [0, -24]);

  return (
    <section ref={ref} className="relative overflow-hidden pb-8 pt-6 md:pb-16 md:pt-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(5,45,222,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(61,185,232,0.12), transparent 35%)',
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[1.05fr_0.95fr]">
        <motion.div {...fadeUp}>
          <h1 className="max-w-xl font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-[var(--onda-ink)]">
            Tu cliente se fue.{' '}
            <span className="text-[var(--onda-primary-500)]">Tu marca</span> no tiene por qué
            irse con él.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--onda-muted)]">
            Onda convierte cada visita en una razón para volver.
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

        <div className="relative mx-auto flex min-h-[420px] w-full max-w-md items-end justify-center lg:min-h-[480px]">
          <ProductPhoto
            src="/product/hero.png"
            alt="Cliente usando Onda con NFC"
            width={640}
            height={720}
            priority
            className="relative z-10 h-auto w-full object-contain drop-shadow-2xl"
            fallback={
              <>
                <motion.div style={{ y: handY }} className="absolute left-2 top-6 z-20 md:left-0">
                  <div className="rounded-full bg-[var(--onda-primary-500)] p-4 shadow-[0_16px_40px_rgba(5,45,222,0.35)]">
                    <OndaHandMark variant="onPrimary" className="h-20 w-auto rotate-[-8deg] md:h-24" />
                  </div>
                </motion.div>
                <motion.div style={{ y: phoneY }} className="relative z-10 -mr-8 md:-mr-12">
                  <PhoneFrame className="w-[200px] md:w-[230px]">
                    <HeroPhoneScreen />
                  </PhoneFrame>
                </motion.div>
                <motion.div style={{ y: standY }} className="relative z-0 mb-4 ml-2 md:mb-8">
                  <NfcStand />
                </motion.div>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}
