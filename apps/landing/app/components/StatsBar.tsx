'use client';

import { useInViewCount } from '../hooks/useInViewCount';

const STATS = [
  { target: 1248, label: 'Ondas entregadas hoy' },
  { target: 387, label: 'Recompensas redimidas hoy' },
  { target: 42, label: 'Negocios en la Onda' },
  { target: 8921, label: 'Personas en la Onda' },
];

function StatItem({ target, label }: { target: number; label: string }) {
  const { ref, value } = useInViewCount(target);
  return (
    <div ref={ref} className="text-center">
      <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
        {value.toLocaleString('es-CO')}
      </p>
      <p className="mt-1 text-sm text-white/80">{label}</p>
    </div>
  );
}

export function StatsBar() {
  return (
    <section className="bg-[var(--onda-primary-500)] py-10 text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <StatItem key={s.label} {...s} />
        ))}
      </div>
    </section>
  );
}
