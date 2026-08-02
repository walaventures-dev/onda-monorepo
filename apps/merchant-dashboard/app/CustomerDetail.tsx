'use client';

import {
  KpiCard,
  promoTypeLabel,
  OndaIcons,
  BadgePill,
} from '@onda/shared-ui';
import { displayPhone } from '@onda/shared-utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
}

function waLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function CustomerDetail({
  detail,
  loading,
  onBack,
}: {
  detail: any | null;
  loading: boolean;
  onBack: () => void;
}) {
  const user = detail?.user;
  const k = detail?.kpis;
  const whatsapp = waLink(user?.phone);

  if (loading && !user) {
    return (
      <div className="onda-card p-8 text-center text-sm text-[var(--onda-muted)]">
        Cargando cliente…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="onda-card space-y-3 p-6 text-center">
        <p className="text-sm text-[var(--onda-muted)]">
          No se pudo cargar el cliente.
        </p>
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-[var(--onda-violet)]"
          onClick={onBack}
        >
          ← Volver al listado
        </button>
      </div>
    );
  }

  const rangeDays =
    detail?.series?.length > 0 && detail.series.length <= 8;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-2 cursor-pointer text-sm font-medium text-[var(--onda-violet)]"
            onClick={onBack}
          >
            ← Clientes
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-[var(--onda-ink)]">
              {user.name}
            </h2>
            {detail.badge ? <BadgePill badge={detail.badge} /> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            {displayPhone(user.phone)}
            {detail.lastVisit
              ? ` · Última visita ${new Date(detail.lastVisit).toLocaleDateString('es-CO')}`
              : ' · Sin visitas aún'}
            {detail.pass?.serialNumber
              ? ` · Serial ${detail.pass.serialNumber}`
              : ''}
          </p>
          {detail.nearPromo ? (
            <p className="mt-1 text-sm text-[var(--onda-ink)]">
              A{' '}
              <span className="font-semibold">{detail.nearPromo.gap}</span>{' '}
              ondas de{' '}
              <span className="font-medium">{detail.nearPromo.title}</span>
              <span className="text-[var(--onda-muted)]">
                {' '}
                ({promoTypeLabel(detail.nearPromo.type)})
              </span>
            </p>
          ) : null}
        </div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(37,211,102,0.28)] transition hover:bg-[#1ebe57] hover:shadow-[0_8px_20px_rgba(37,211,102,0.35)] active:scale-[0.98]"
          >
            {OndaIcons.whatsapp}
            Escribir por WhatsApp
          </a>
        ) : null}
      </div>

      <div className="onda-kpi-grid">
        <KpiCard
          label="Ondas en periodo"
          value={k?.ondas ?? 0}
          delta={deltaLabel(k?.ondasDelta)}
          positive={(k?.ondasDelta ?? 0) >= 0}
        />
        <KpiCard
          label="Canjes"
          value={k?.canjes ?? 0}
          delta={deltaLabel(k?.canjesDelta)}
          positive={(k?.canjesDelta ?? 0) >= 0}
        />
        <KpiCard
          label="Visitas"
          value={k?.visitas ?? 0}
          delta={deltaLabel(k?.visitasDelta)}
          positive={(k?.visitasDelta ?? 0) >= 0}
        />
        <KpiCard label="Saldo actual" value={k?.puntosActuales ?? 0} />
        <KpiCard
          label="Días sin visita"
          value={k?.diasDesdeVisita ?? '—'}
          positive={(k?.diasDesdeVisita ?? 0) < 21}
        />
        <KpiCard
          label="Ticket medio (ondas)"
          value={k?.ticketMedioOndas ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="onda-card flex h-52 min-h-0 flex-col overflow-hidden p-4 lg:col-span-2">
          <h3 className="font-display shrink-0 text-sm font-semibold">
            Comportamiento en el tiempo
          </h3>
          <div className="relative mt-2 min-h-0 flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                {rangeDays ? (
                  <BarChart
                    data={detail.series || []}
                    margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(5)}
                      fontSize={10}
                    />
                    <YAxis fontSize={10} allowDecimals={false} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    <Bar
                      dataKey="ondas"
                      name="Ondas"
                      fill="#3DB9E8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="canjes"
                      name="Canjes"
                      fill="#6E5AE6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <LineChart
                    data={detail.series || []}
                    margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(5)}
                      fontSize={10}
                    />
                    <YAxis fontSize={10} allowDecimals={false} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    <Line
                      type="monotone"
                      dataKey="ondas"
                      name="Ondas"
                      stroke="#3DB9E8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="canjes"
                      name="Canjes"
                      stroke="#6E5AE6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="onda-card flex h-52 min-h-0 flex-col overflow-hidden p-4">
          <h3 className="font-display shrink-0 text-sm font-semibold">
            Totales históricos
          </h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex justify-between gap-2 border-b border-[var(--onda-border)] pb-2">
              <span className="text-[var(--onda-muted)]">Ondas acumuladas</span>
              <span className="font-medium">{k?.ondasAllTime ?? 0}</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-[var(--onda-border)] pb-2">
              <span className="text-[var(--onda-muted)]">Canjes totales</span>
              <span className="font-medium">{k?.canjesAllTime ?? 0}</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-[var(--onda-border)] pb-2">
              <span className="text-[var(--onda-muted)]">Visitas totales</span>
              <span className="font-medium">{k?.visitasAllTime ?? 0}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-[var(--onda-muted)]">Cliente desde</span>
              <span className="font-medium">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('es-CO')
                  : '—'}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-4 py-3">
            <h3 className="font-display text-sm font-semibold">
              Actividad del periodo
            </h3>
          </div>
          <ul className="max-h-80 space-y-0 overflow-auto">
            {(detail.recent || []).map((t: any) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--onda-border)] px-4 py-2.5 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--onda-ink)]">
                    {t.type === 'ACCUMULATE' ? 'Acumulación' : 'Redención'}
                  </p>
                  <p className="truncate text-xs text-[var(--onda-muted)]">
                    {t.promotion?.title ||
                      (t.type === 'REDEEM'
                        ? promoTypeLabel(t.promotion?.type)
                        : 'Onda')}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--onda-muted)]">
                    {new Date(t.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    t.type === 'ACCUMULATE'
                      ? 'text-[var(--onda-sky)]'
                      : 'text-[var(--onda-violet)]'
                  }`}
                >
                  {t.type === 'ACCUMULATE' ? '+' : '−'}
                  {t.points}
                </span>
              </li>
            ))}
            {!detail.recent?.length ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--onda-muted)]">
                Sin movimientos en este periodo. Prueba ampliar las fechas.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-4 py-3">
            <h3 className="font-display text-sm font-semibold">
              Promos vs su saldo
            </h3>
          </div>
          <ul className="max-h-80 space-y-0 overflow-auto">
            {(detail.eligiblePromos || []).map((p: any) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--onda-border)] px-4 py-2.5 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {promoTypeLabel(p.type)} · {p.pointsRequired} ondas
                  </p>
                </div>
                {p.ready ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--onda-success)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--onda-success)]">
                    {OndaIcons.check}
                    Lista
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--onda-muted)]">
                    {OndaIcons.target}
                    faltan {p.gap}
                  </span>
                )}
              </li>
            ))}
            {!detail.eligiblePromos?.length ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--onda-muted)]">
                No hay promos activas en el catálogo.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
