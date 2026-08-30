'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { LightningIcon as Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { WalletIcon as Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import {
  LEAD_ROLES,
  LEAD_SOURCES,
  type LeadRole,
  type LeadSource,
} from '@onda/shared-types';
import {
  formatColombiaCity,
  isColombiaMunicipality,
  isCompletePhoneMask,
} from '@onda/shared-utils';
import {
  api,
  ColombiaPlaceFields,
  OndaLogo,
  OndaSelect,
  PhoneInput,
} from '@onda/shared-ui';

const PILLARS = [
  { icon: Wallet, text: 'Pase en Apple y Google Wallet — sin app' },
  { icon: Gift, text: 'Ondas: progreso claro hacia la recompensa' },
  { icon: Lightning, text: 'Te mostramos Onda en una llamada corta' },
];

const ROLE_OPTIONS = LEAD_ROLES.map((label) => ({ id: label, label }));
const SOURCE_OPTIONS = LEAD_SOURCES.map((label) => ({ id: label, label }));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD =
  'w-full rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-3 text-[17px] text-[var(--onda-ink)] outline-none transition hover:border-[var(--onda-bridge)] focus:border-[var(--onda-bridge)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--onda-primary-100)]';

const LABEL =
  'text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-[var(--onda-muted)]';

type FormState = {
  name: string;
  businessName: string;
  phone: string;
  phoneE164: string;
  email: string;
  department: string;
  municipality: string;
  role: LeadRole | '';
  source: LeadSource | '';
  website: string;
};

const EMPTY: FormState = {
  name: '',
  businessName: '',
  phone: '',
  phoneE164: '',
  email: '',
  department: '',
  municipality: '',
  role: '',
  source: '',
  website: '',
};

export default function DemoPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('El nombre es requerido');
    if (!form.businessName.trim()) {
      return setError('El nombre del negocio es requerido');
    }
    if (!isCompletePhoneMask(form.phone) || !form.phoneE164) {
      return setError('El WhatsApp no es válido');
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      return setError('El correo no es válido');
    }
    if (!form.department) return setError('Elige el departamento');
    if (!isColombiaMunicipality(form.department, form.municipality)) {
      return setError('Elige el municipio');
    }
    if (!form.role) return setError('Elige tu cargo');
    if (!form.source) return setError('Cuéntanos cómo nos conociste');

    setBusy(true);
    try {
      await api('/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          businessName: form.businessName.trim(),
          phone: form.phoneE164,
          email: form.email.trim(),
          city: formatColombiaCity(form.municipality, form.department),
          role: form.role,
          source: form.source,
          website: form.website,
        }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--onda-bg)] text-[var(--onda-ink)]">
      <header className="border-b border-[var(--onda-border)] bg-[color-mix(in_srgb,var(--onda-bg)_88%,white)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <a href="/" aria-label="Onda inicio">
            <OndaLogo />
          </a>
          <a
            href="/"
            className="text-sm font-semibold text-[var(--onda-muted)] transition hover:text-[var(--onda-ink)]"
          >
            Volver
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-6 py-16 md:grid-cols-[1fr_1.05fr] md:py-24">
        <section className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-primary-500)]">
            Demo comercial
          </p>
          <h1 className="font-display mt-3 text-[clamp(1.85rem,4.5vw,3rem)] font-bold tracking-tight">
            Agenda un demo. Te llamamos.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--onda-muted)]">
            Cuéntanos de tu negocio y te contactamos para mostrarte Onda en una
            llamada corta.
          </p>
          <figure className="mt-8">
            <Image
              src="/brand/funnel_image.png"
              alt="Equipo Onda acompañando a un comercio"
              width={1024}
              height={768}
              priority
              className="h-auto w-full object-contain object-center"
            />
          </figure>
          <ul className="mt-6 space-y-4">
            {PILLARS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                  <Icon size={20} weight="regular" aria-hidden />
                </span>
                <span className="pt-2 text-[15px] leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ml-auto w-full max-w-md rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-6 shadow-[0_12px_32px_rgba(26,27,46,0.06)] md:p-8">
          {done ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-500)]">
                <Check size={28} weight="regular" aria-hidden />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Listo</h2>
              <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-[var(--onda-muted)]">
                Te llamamos para agendar el demo.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="relative space-y-4" noValidate>
              <p className="font-display text-lg font-semibold">Tus datos</p>

              <label className="onda-field">
                <span className={LABEL}>Nombre</span>
                <input
                  className={FIELD}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </label>

              <label className="onda-field">
                <span className={LABEL}>Nombre del negocio</span>
                <input
                  className={FIELD}
                  autoComplete="organization"
                  value={form.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                  required
                />
              </label>

              <label className="onda-field">
                <span className={LABEL}>WhatsApp</span>
                <PhoneInput
                  value={form.phone}
                  onChange={(masked) => set('phone', masked)}
                  onE164Change={(e164) => set('phoneE164', e164)}
                  className={FIELD}
                  required
                />
              </label>

              <label className="onda-field">
                <span className={LABEL}>Correo</span>
                <input
                  type="email"
                  className={FIELD}
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </label>

              <ColombiaPlaceFields
                department={form.department}
                municipality={form.municipality}
                onDepartmentChange={(department) => set('department', department)}
                onMunicipalityChange={(municipality) =>
                  set('municipality', municipality)
                }
                labelClassName={LABEL}
                inputClassName={FIELD}
              />

              <div className="onda-field">
                <span className={LABEL} id="demo-role-label">
                  Cargo
                </span>
                <OndaSelect
                  value={form.role}
                  onChange={(v) => set('role', v as LeadRole)}
                  options={ROLE_OPTIONS}
                  placeholder="Seleccionar…"
                  aria-label="Cargo"
                />
              </div>

              <div className="onda-field">
                <span className={LABEL} id="demo-source-label">
                  Cómo nos conoció
                </span>
                <OndaSelect
                  value={form.source}
                  onChange={(v) => set('source', v as LeadSource)}
                  options={SOURCE_OPTIONS}
                  placeholder="Seleccionar…"
                  aria-label="Cómo nos conoció"
                />
              </div>

              <div className="pointer-events-none absolute left-[-9999px] h-px w-px overflow-hidden opacity-0" aria-hidden="true">
                <label>
                  Sitio web
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                  />
                </label>
              </div>

              {error ? (
                <p className="text-sm text-[var(--onda-danger)]" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(5,45,222,0.28)] transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Enviando…' : 'Quiero que me llamen'}
              </button>
              <p className="text-center text-xs leading-relaxed text-[var(--onda-muted)]">
                Usamos estos datos solo para contactarte y agendar el demo.
              </p>
            </form>
          )}
        </section>
      </main>

      <footer className="border-t border-[var(--onda-border)] bg-[var(--onda-card)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-[var(--onda-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Onda · Colombia</p>
          <p className="flex gap-4">
            <a href="/privacidad" className="hover:text-[var(--onda-ink)]">
              Privacidad
            </a>
            <a href="/terminos" className="hover:text-[var(--onda-ink)]">
              Términos
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
