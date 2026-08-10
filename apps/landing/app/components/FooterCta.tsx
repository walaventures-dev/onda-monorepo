'use client';

import { DeviceMobileIcon as DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { LightningIcon as Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { ShieldCheckIcon as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { OndaLogo } from '@onda/shared-ui';
import { onboardingUrl } from '../lib/pricing';

const BADGES = [
  { icon: DeviceMobile, label: 'Sin app' },
  { icon: Lightning, label: 'Setup rápido' },
  { icon: ShieldCheck, label: 'Pago seguro' },
];

export function FooterCta() {
  return (
    <footer>
      <section className="bg-[var(--onda-primary-500)] py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <OndaLogo variant="onPrimary" />
            <p className="mt-4 font-display text-2xl font-semibold md:text-3xl">
              ¿Tu negocio ya está en la Onda?
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-4 md:justify-start">
              {BADGES.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-sm text-white/85">
                  <Icon size={18} weight="regular" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <a
            href={onboardingUrl()}
            className="inline-flex rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[var(--onda-primary-500)] shadow-lg transition hover:bg-[var(--onda-primary-50)] active:scale-[0.98]"
          >
            Poner mi negocio en la Onda →
          </a>
        </div>
      </section>

      <div className="border-t border-[var(--onda-border)] bg-[var(--onda-bg)] py-8 text-center text-sm text-[var(--onda-muted)]">
        <div className="mb-3 flex justify-center gap-4">
          <a href="/privacidad" className="text-[var(--onda-primary-500)] hover:underline">
            Privacidad
          </a>
          <a href="/terminos" className="text-[var(--onda-primary-500)] hover:underline">
            Términos
          </a>
        </div>
        © {new Date().getFullYear()} Onda · onda.lat
      </div>
    </footer>
  );
}
