"use client";

import type { ReactNode } from "react";
import {
  OndaHandMark,
  promoTypeLabel,
  OndaIcons,
  BadgePill,
  TxActivityRow,
  SkeletonDetail,
} from "@onda/shared-ui";
import { displayPhone, formatCop } from "@onda/shared-utils";
import { CurrencyCircleDollarIcon as CurrencyCircleDollar } from "@phosphor-icons/react/dist/csr/CurrencyCircleDollar";
import { CalendarBlankIcon as CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
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
} from "recharts";

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function waLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function formatRoi(roi?: number | null) {
  if (roi == null || !Number.isFinite(roi)) return "—";
  return `${roi.toFixed(1)}x`;
}

function Delta({ label, positive }: { label?: string; positive?: boolean }) {
  if (!label) return null;
  return (
    <span
      className={`text-xs font-medium ${
        positive ? "text-[var(--onda-success)]" : "text-[var(--onda-danger)]"
      }`}
    >
      {label}
    </span>
  );
}

function KpiStat({
  label,
  value,
  delta,
  positive,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--onda-muted)]" title={hint}>
        {label}
      </p>
      <p className="mt-0.5 truncate font-display text-base font-semibold tabular-nums text-[var(--onda-ink)]">
        {value}
      </p>
      <Delta label={delta} positive={positive} />
    </div>
  );
}

function KpiCluster({
  title,
  subtitle,
  icon,
  tone,
  heroLabel,
  heroValue,
  heroDelta,
  heroPositive,
  statsCols = 3,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: "sky" | "primary" | "amber";
  heroLabel: string;
  heroValue: string | number;
  heroDelta?: string;
  heroPositive?: boolean;
  statsCols?: 2 | 3;
  children: ReactNode;
}) {
  const tones = {
    sky: {
      wrap: "border-[var(--onda-sky)]/20 bg-[linear-gradient(160deg,var(--onda-sky-soft)_0%,white_50%)]",
      icon: "bg-[var(--onda-sky-soft)] text-[var(--onda-sky)]",
    },
    primary: {
      wrap: "border-[var(--onda-primary)]/15 bg-[linear-gradient(160deg,var(--onda-primary-50)_0%,white_50%)]",
      icon: "bg-[var(--onda-violet-soft)] text-[var(--onda-primary)]",
    },
    amber: {
      wrap: "border-[#F5A524]/25 bg-[linear-gradient(160deg,#FFF6E5_0%,white_50%)]",
      icon: "bg-[#FFF6E5] text-[#D97706]",
    },
  }[tone];

  return (
    <section
      className={`onda-card flex h-full flex-col border p-4 ${tones.wrap}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones.icon}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-[var(--onda-ink)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--onda-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--onda-muted)]">
          {heroLabel}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
          <p className="font-display text-3xl font-semibold tabular-nums text-[var(--onda-ink)]">
            {heroValue}
          </p>
          <Delta label={heroDelta} positive={heroPositive} />
        </div>
      </div>

      <div
        className={`mt-4 grid flex-1 gap-x-3 gap-y-3 border-t border-[var(--onda-border)]/80 pt-3 ${
          statsCols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {children}
      </div>
    </section>
  );
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
    return <SkeletonDetail />;
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

  const rangeDays = detail?.series?.length > 0 && detail.series.length <= 8;

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
              ? ` · Última visita ${new Date(detail.lastVisit).toLocaleDateString("es-CO")}`
              : " · Sin visitas aún"}
            {detail.pass?.serialNumber
              ? ` · Serial ${detail.pass.serialNumber}`
              : ""}
          </p>
          {detail.ondaValue != null && Number(detail.ondaValue) > 0 ? (
            <p className="mt-1 text-xs text-[var(--onda-muted)]">
              Una onda cuesta {formatCop(Number(detail.ondaValue))}
            </p>
          ) : null}
          {detail.nearPromo ? (
            <p className="mt-1 text-sm text-[var(--onda-ink)]">
              A <span className="font-semibold">{detail.nearPromo.gap}</span>{" "}
              ondas de{" "}
              <span className="font-medium">{detail.nearPromo.title}</span>
              <span className="text-[var(--onda-muted)]">
                {" "}
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
            className="onda-wa-btn"
          >
            {OndaIcons.whatsapp}
            Escribir por WhatsApp
          </a>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
        <KpiCluster
          title="Dinero"
          subtitle="Cuánto dejó y cuánto te costó"
          tone="sky"
          icon={
            <CurrencyCircleDollar
              className="h-5 w-5"
              weight="regular"
              aria-hidden
            />
          }
          heroLabel="Ventas"
          heroValue={formatCop(k?.ventas ?? 0)}
          heroDelta={deltaLabel(k?.ventasDelta)}
          heroPositive={(k?.ventasDelta ?? 0) >= 0}
        >
          <KpiStat
            label="Costo canjes"
            hint="Costo estimado de los canjes en el periodo."
            value={formatCop(k?.beneficioOtorgado ?? 0)}
            delta={deltaLabel(k?.beneficioDelta)}
            positive={(k?.beneficioDelta ?? 0) <= 0}
          />
          <KpiStat
            label="ROI"
            hint="Ventas ÷ costo de canjes."
            value={formatRoi(k?.roi)}
          />
          <KpiStat
            label="Ticket medio"
            value={formatCop(k?.ticketMedioCop ?? 0)}
          />
        </KpiCluster>

        <KpiCluster
          title="Actividad"
          subtitle="Qué tan seguido viene"
          tone="amber"
          icon={
            <CalendarBlank className="h-5 w-5" weight="regular" aria-hidden />
          }
          heroLabel="Visitas"
          heroValue={k?.visitas ?? 0}
          heroDelta={deltaLabel(k?.visitasDelta)}
          heroPositive={(k?.visitasDelta ?? 0) >= 0}
          statsCols={2}
        >
          <KpiStat
            label="Canjes"
            value={k?.canjes ?? 0}
            delta={deltaLabel(k?.canjesDelta)}
            positive={(k?.canjesDelta ?? 0) >= 0}
          />
          <KpiStat
            label="Sin visitar"
            value={
              k?.diasDesdeVisita == null
                ? "—"
                : k.diasDesdeVisita === 0
                  ? "Hoy"
                  : `${k.diasDesdeVisita} d`
            }
            positive={(k?.diasDesdeVisita ?? 0) < 21}
          />
        </KpiCluster>

        <KpiCluster
          title="Ondas"
          subtitle="Saldo y ritmo de acumulación"
          tone="primary"
          icon={<OndaHandMark variant="current" className="h-5 w-5" />}
          heroLabel="Saldo actual"
          heroValue={k?.puntosActuales ?? 0}
        >
          <KpiStat
            label="Ganadas"
            hint="Ondas que sumó en el periodo."
            value={k?.ondas ?? 0}
            delta={deltaLabel(k?.ondasDelta)}
            positive={(k?.ondasDelta ?? 0) >= 0}
          />
          <KpiStat
            label="Por visita"
            hint="Promedio de ondas que gana en cada visita."
            value={k?.ticketMedioOndas ?? 0}
          />
          {detail.nearPromo ? (
            <KpiStat
              label="Faltan"
              hint={`Para canjear «${detail.nearPromo.title}»`}
              value={detail.nearPromo.gap}
            />
          ) : (
            <KpiStat label="Histórico" value={k?.ondasAllTime ?? 0} />
          )}
        </KpiCluster>
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
              <span className="text-[var(--onda-muted)]">Ventas</span>
              <span className="font-medium">
                {formatCop(k?.ventasAllTime ?? 0)}
              </span>
            </li>
            <li className="flex justify-between gap-2 border-b border-[var(--onda-border)] pb-2">
              <span className="text-[var(--onda-muted)]">
                Beneficio otorgado
              </span>
              <span className="font-medium">
                {formatCop(k?.beneficioAllTime ?? 0)}
              </span>
            </li>
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
                  ? new Date(user.createdAt).toLocaleDateString("es-CO")
                  : "—"}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold">
              Actividad del periodo
            </h3>
          </div>
          <ul className="max-h-80 overflow-auto px-5 py-3">
            {(detail.recent || []).map((t: any) => (
              <TxActivityRow
                key={t.id}
                item={{
                  id: t.id,
                  type: t.type,
                  points: t.points,
                  paymentAmount: t.paymentAmount,
                  benefitAmount: t.benefitAmount,
                  promotion: t.promotion
                    ? { title: t.promotion.title, type: t.promotion.type }
                    : null,
                  time: new Date(t.createdAt).toLocaleString("es-CO"),
                }}
              />
            ))}
            {!detail.recent?.length ? (
              <li className="py-8 text-center text-sm text-[var(--onda-muted)]">
                Sin movimientos en este periodo. Prueba ampliar las fechas.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold">
              Promos vs su saldo
            </h3>
          </div>
          <ul className="max-h-80 space-y-0 overflow-auto px-5 py-2">
            {(detail.eligiblePromos || []).map((p: any) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--onda-border)] py-3 text-sm last:border-b-0"
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
              <li className="py-8 text-center text-sm text-[var(--onda-muted)]">
                No hay promos activas en el catálogo.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
