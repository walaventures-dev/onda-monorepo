"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { CashRegisterIcon as CashRegister } from "@phosphor-icons/react/dist/csr/CashRegister";
import { GiftIcon as Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { MegaphoneIcon as Megaphone } from "@phosphor-icons/react/dist/csr/Megaphone";
import { WalletIcon as Wallet } from "@phosphor-icons/react/dist/csr/Wallet";
import { onboardingUrl, SHOW_POS_LANDING } from "../lib/pricing";
import {
  easeSoft,
  heroItem,
  heroMount,
  heroVisual,
  staggerContainerFast,
  staggerItemSoft,
} from "../lib/motion";

/** S del wordmark (n→d): mismos cubics para que el morph no salte. */
const WAVE_A = "M 8 18 C 52 18 62 6 108 12 C 154 18 168 22 192 14";
const WAVE_B = "M 8 16 C 52 21 62 8 108 10 C 154 16 168 20 192 17";

function HeroHighlight({ children }: { children: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className="relative inline-block whitespace-nowrap pb-[0.22em] text-[var(--onda-primary-500)]">
      <span className="relative z-[1]">{children}</span>
      <svg
        className="pointer-events-none absolute inset-x-[-6%] bottom-0 z-0 h-[0.34em] w-[112%] overflow-visible"
        viewBox="0 0 200 28"
        fill="none"
        aria-hidden
        preserveAspectRatio="none"
      >
        <motion.path
          d={WAVE_A}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: "0.11em" }}
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0.3 }}
          animate={{
            pathLength: 1,
            opacity: 1,
            d: reduceMotion ? WAVE_A : [WAVE_A, WAVE_B, WAVE_A],
          }}
          transition={{
            pathLength: { duration: 0.95, delay: 0.48, ease: easeSoft },
            opacity: { duration: 0.35, delay: 0.48 },
            d: {
              duration: 3.8,
              delay: 1.55,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        />
      </svg>
    </span>
  );
}

const VALUE_POINTS = [
  { icon: Gift, title: "Lealtad", desc: "Ondas hacia el premio" },
  ...(SHOW_POS_LANDING
    ? [{ icon: CashRegister, title: "POS", desc: "Vende e inventaria" }]
    : []),
  { icon: Wallet, title: "Wallet", desc: "Sin descargar app" },
  { icon: Megaphone, title: "Campañas", desc: "Llena el local" },
];

export function HeroSection() {
  const ref = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const visualY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : 56],
  );
  const visualScale = useTransform(
    scrollYProgress,
    [0, 1],
    [1, reduceMotion ? 1 : 0.97],
  );

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pb-8 pt-6 md:pb-16 md:pt-10"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(5,45,222,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(61,185,232,0.12), transparent 35%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[1fr_1.05fr]">
        <motion.div {...heroMount} className="flex flex-col">
          <motion.h1
            variants={heroItem}
            className="max-w-xl overflow-visible font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-[var(--onda-ink)]"
          >
            {SHOW_POS_LANDING ? (
              <>
                Cobra. Haz que <HeroHighlight>vuelvan</HeroHighlight>.
              </>
            ) : (
              <>
                Haz que <HeroHighlight>vuelvan</HeroHighlight>.
              </>
            )}
          </motion.h1>
          <motion.p
            variants={heroItem}
            className="mt-5 max-w-lg text-lg text-[var(--onda-muted)]"
          >
            {SHOW_POS_LANDING
              ? "POS para vender e inventariar, y un pase en Wallet para que el cliente vuelva por el premio — sin app que descargar."
              : "Un pase en Wallet para que el cliente vuelva por el premio — sin app que descargar."}
          </motion.p>

          <motion.div
            variants={staggerContainerFast}
            className={`mt-8 grid gap-4 ${
              VALUE_POINTS.length === 4
                ? "grid-cols-2 sm:grid-cols-4"
                : "grid-cols-3"
            }`}
          >
            {VALUE_POINTS.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={staggerItemSoft}
                className="flex flex-col gap-1.5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                  <Icon size={20} weight="regular" />
                </span>
                <p className="text-sm font-semibold text-[var(--onda-ink)]">
                  {title}
                </p>
                <p className="text-xs text-[var(--onda-muted)]">{desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            variants={heroItem}
            className="mt-9 flex flex-col items-start gap-3"
          >
            <a
              href={onboardingUrl()}
              className="inline-flex rounded-full bg-[var(--onda-primary-500)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
            >
              Poner mi negocio en la Onda →
            </a>
            <p className="text-sm text-[var(--onda-muted)]">
              Toma menos de 5 minutos empezar.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: visualY, scale: visualScale }}
          variants={heroVisual}
          initial="hidden"
          animate="show"
          className="relative mx-auto w-full max-w-xl will-change-transform"
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
