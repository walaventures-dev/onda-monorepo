'use client';

import { useEffect, useState } from 'react';
import { OndaLogo, api } from '@onda/shared-ui';

export default function FestivalNeivaPage() {
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    api('/events/slug/festival-neiva')
      .then(setEvent)
      .catch(() => setEvent(null));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <OndaLogo />
        <a href="/" className="text-sm text-[var(--onda-violet)]">
          Volver
        </a>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="overflow-hidden rounded-3xl onda-gradient p-10 text-white">
          <p className="text-sm uppercase tracking-widest text-white/80">Evento oficial</p>
          <h1 className="font-display mt-2 text-4xl font-bold md:text-5xl">
            {event?.name || 'Festival a la Carta Neiva'}
          </h1>
          <p className="mt-3 max-w-xl text-white/85">
            Acumula {event?.globalTarget || 10} ondas en el circuito y participa por el premio
            mayor.
          </p>
        </div>
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Comercios aliados</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(event?.stores || [])
              .filter((m: any) => m.status === 'ACCEPTED')
              .map((m: any) => (
                <div key={m.id} className="onda-card p-5">
                  <h3 className="font-semibold">{m.store?.name}</h3>
                  <p className="text-sm text-[var(--onda-muted)]">
                    {m.customPromo || 'Parte del circuito Onda'}
                  </p>
                </div>
              ))}
            {!event && (
              <p className="text-[var(--onda-muted)]">
                Conecta la API para ver comercios en vivo.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
