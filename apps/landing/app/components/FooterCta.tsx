'use client';

import { motion } from 'framer-motion';
import { CashRegisterIcon as CashRegister } from '@phosphor-icons/react/dist/csr/CashRegister';
import { DeviceMobileIcon as DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { EnvelopeSimpleIcon as EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { LightningIcon as Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { MapPinIcon as MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { ShieldCheckIcon as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { WalletIcon as Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { OndaLogo, OndaWordmark } from '@onda/shared-ui';
import { fadeUp, inViewStagger, staggerItem } from '../lib/motion';
import { demoUrl, onboardingUrl, SHOW_POS_LANDING } from '../lib/pricing';

const BADGES = [
  ...(SHOW_POS_LANDING
    ? [{ icon: CashRegister, label: 'POS + lealtad en un solo lugar' }]
    : [{ icon: Gift, label: 'Lealtad con Ondas en Wallet' }]),
  { icon: DeviceMobile, label: 'Sin app que descargar' },
  { icon: Wallet, label: 'Apple y Google Wallet' },
  { icon: Lightning, label: 'Listo en minutos' },
];

const PRODUCT_LINKS = [
  {
    href: '#producto',
    label: SHOW_POS_LANDING ? 'Lealtad y POS' : 'Lealtad',
  },
  ...(SHOW_POS_LANDING ? [{ href: '#pos', label: 'Punto de venta' }] : []),
  { href: '#demo', label: 'Pruébalo en vivo' },
  { href: demoUrl(), label: 'Pedir un demo' },
  { href: '#campanas', label: 'Campañas' },
  { href: '#pricing', label: 'Planes y precios' },
];

const TRUST_POINTS = [
  'Hecho en Colombia para comercios locales',
  SHOW_POS_LANDING
    ? 'Cobra en el POS y fideliza con Ondas'
    : 'Fideliza con Ondas en cada visita',
  'El cliente guarda el pase en su Wallet',
  'Activación digital; Kit físico en 6 y 12 meses',
];

export function FooterCta() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <section className="bg-[var(--onda-primary-500)] py-14 text-white">
        <motion.div
          {...inViewStagger}
          className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 text-center md:flex-row md:justify-between md:text-left"
        >
          <div>
            <motion.div variants={staggerItem}>
              <OndaLogo variant="onPrimary" />
            </motion.div>
            <motion.p
              variants={staggerItem}
              className="mt-4 font-display text-2xl font-semibold md:text-3xl"
            >
              {SHOW_POS_LANDING
                ? '¿Listo para cobrar y que vuelvan?'
                : '¿Listo para que vuelvan?'}
            </motion.p>
            <motion.div
              variants={staggerItem}
              className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3 md:justify-start"
            >
              {BADGES.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-sm text-white/85">
                  <Icon size={18} weight="regular" />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>
          <motion.div
            variants={staggerItem}
            className="flex shrink-0 flex-col items-stretch gap-3 sm:items-center md:items-end"
          >
            <a
              href={onboardingUrl()}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[var(--onda-primary-500)] shadow-lg transition hover:bg-[var(--onda-primary-50)] active:scale-[0.98]"
            >
              Poner mi negocio en la Onda →
            </a>
            <a
              href={demoUrl()}
              className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              Pedir un demo
            </a>
          </motion.div>
        </motion.div>
      </section>

      <motion.div {...fadeUp} className="border-t border-[var(--onda-border)] bg-[var(--onda-card)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            <a href="/" aria-label="Onda inicio">
              <OndaWordmark className="h-8 w-auto" />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--onda-muted)]">
              {SHOW_POS_LANDING
                ? 'POS y lealtad con Ondas en Wallet. Cobra el día a día y haz que el cliente vuelva por el premio — sin app extra.'
                : 'Lealtad con Ondas en Wallet. Haz que el cliente vuelva por el premio — sin app extra.'}
            </p>
            <div className="mt-5 space-y-2 text-sm text-[var(--onda-muted)]">
              <p className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-[var(--onda-primary-500)]" weight="fill" />
                Colombia
              </p>
              <a
                href="mailto:hola@entraenlaonda.com"
                className="inline-flex items-center gap-2 transition-colors hover:text-[var(--onda-ink)]"
              >
                <EnvelopeSimple size={16} className="text-[var(--onda-primary-500)]" weight="fill" />
                hola@entraenlaonda.com
              </a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Producto
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-[var(--onda-ink)] transition-colors hover:text-[var(--onda-primary-500)]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Confianza
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--onda-muted)]">
              {TRUST_POINTS.map((t) => (
                <li key={t} className="flex gap-2">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--onda-success)]"
                    weight="fill"
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Legal y contacto
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="/privacidad"
                  className="text-[var(--onda-ink)] transition-colors hover:text-[var(--onda-primary-500)]"
                >
                  Política de privacidad
                </a>
              </li>
              <li>
                <a
                  href="/terminos"
                  className="text-[var(--onda-ink)] transition-colors hover:text-[var(--onda-primary-500)]"
                >
                  Términos de uso
                </a>
              </li>
              <li>
                <a
                  href="mailto:privacidad@entraenlaonda.com"
                  className="text-[var(--onda-ink)] transition-colors hover:text-[var(--onda-primary-500)]"
                >
                  privacidad@entraenlaonda.com
                </a>
              </li>
              <li>
                <a
                  href="mailto:hola@entraenlaonda.com"
                  className="text-[var(--onda-ink)] transition-colors hover:text-[var(--onda-primary-500)]"
                >
                  Soporte · hola@entraenlaonda.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--onda-border)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-[var(--onda-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {year} Onda · entraenlaonda.com · Operamos en Colombia</p>
            <p>Wallet, WhatsApp y datos tratados conforme a nuestra política de privacidad.</p>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
