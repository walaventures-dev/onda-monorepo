'use client';

import React from 'react';

export function LegalLayout({
  title,
  updated,
  children,
  backHref = '/',
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--onda-bg)] text-[var(--onda-ink)]">
      <header className="border-b border-[var(--onda-border)] bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <a href={backHref} className="text-sm font-medium text-[var(--onda-violet)]">
            ← Volver
          </a>
          <span className="font-display text-lg font-semibold">Onda</span>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--onda-muted)]">Última actualización: {updated}</p>
        <div className="onda-legal prose mt-8 space-y-5 text-[0.95rem] leading-relaxed text-[var(--onda-ink)]">
          {children}
        </div>
      </article>
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <>
      <section>
        <h2 className="font-display text-xl font-semibold">1. Quiénes somos</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Onda (Wala / onda.lat) opera una plataforma de lealtad digital mediante pases en Apple
          Wallet y Google Wallet, acumulación de “ondas” y comunicaciones por WhatsApp a través de
          un número de plataforma.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">2. Datos que recopilamos</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--onda-muted)]">
          <li>Nombre y número de WhatsApp (formato E.164).</li>
          <li>Identificadores de pase, puntos/ondas y transacciones en comercios o eventos.</li>
          <li>Datos técnicos de sesión (cookies/localStorage) para reconocer tu pase.</li>
          <li>Opiniones o calificaciones si usas el módulo de feedback (planes PRO).</li>
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">3. Para qué los usamos</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--onda-muted)]">
          <li>Emitir y actualizar tu pase digital de lealtad.</li>
          <li>Registrar acumulaciones y redenciones en el comercio o evento.</li>
          <li>Enviarte notificaciones de bienvenida, puntos o campañas desde el WhatsApp de Onda.</li>
          <li>Analítica agregada para comercios y organizadores (sin vender tu número a terceros).</li>
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">4. Base legal y conservación</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Tratamos tus datos con base en tu consentimiento al enrolarte (NFC/QR) y en la ejecución
          del programa de lealtad. Conservamos la información mientras tu pase esté activo o mientras
          el comercio/evento lo requiera para auditoría, salvo solicitudes de eliminación.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">5. Compartición</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Compartimos datos necesarios con el comercio o evento donde te enrolaste, y con proveedores
          que habilitan el servicio (Wallet API, Kapso/WhatsApp, infraestructura cloud). No vendemos
          tu información personal.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">6. Tus derechos</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a{' '}
          <a className="text-[var(--onda-violet)] underline" href="mailto:privacidad@onda.lat">
            privacidad@onda.lat
          </a>
          . También puedes dejar de recibir mensajes respondiendo según las opciones de WhatsApp.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">7. Contacto</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Onda · Colombia · privacidad@onda.lat
        </p>
      </section>
    </>
  );
}

export function TermsContent() {
  return (
    <>
      <section>
        <h2 className="font-display text-xl font-semibold">1. Aceptación</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Al escanear un NFC/QR de Onda, enrolarte o usar un pase digital, aceptas estos Términos y
          Condiciones y la Política de Privacidad.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">2. El servicio</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Onda permite a comercios y organizadores emitir pases de lealtad, acumular y canjear
          “ondas”, y comunicar beneficios. Las promociones concretas las define cada comercio o
          evento y pueden cambiar.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">3. Uso aceptable</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--onda-muted)]">
          <li>Debes proporcionar datos veraces (nombre y WhatsApp).</li>
          <li>No puedes manipular puntos, PIN de caja ni dispositivos NFC ajenos.</li>
          <li>Un pase es personal; el comercio puede exigir identificación razonable al canjear.</li>
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">4. Comunicaciones</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Al enrolarte autorizas a Onda a enviarte mensajes por WhatsApp relacionados con tu pase,
          puntos y beneficios del programa, desde el número oficial de la plataforma.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">5. Limitación</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Onda no garantiza disponibilidad ininterrumpida de Wallet, WhatsApp o redes de terceros.
          Los premios dependen del stock y reglas del comercio/evento.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">6. Cambios</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Podemos actualizar estos términos. La versión vigente se publica en onda.lat/terminos.
          El uso continuado tras un cambio implica aceptación.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">7. Contacto</h2>
        <p className="mt-2 text-[var(--onda-muted)]">
          Consultas legales: legal@onda.lat
        </p>
      </section>
    </>
  );
}

export function PoliciesConsent({
  checked,
  onChange,
  privacyHref = '/privacidad',
  termsHref = '/terminos',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  privacyHref?: string;
  termsHref?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-left text-sm leading-snug text-[var(--onda-muted)]">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--onda-violet)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        Al empezar, acepto la{' '}
        <a
          href={privacyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--onda-violet)] underline"
          onClick={(e) => e.stopPropagation()}
        >
          Política de Privacidad
        </a>{' '}
        y los{' '}
        <a
          href={termsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--onda-violet)] underline"
          onClick={(e) => e.stopPropagation()}
        >
          Términos y Condiciones
        </a>
        .
      </span>
    </label>
  );
}
