"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  type NavCluster,
  KpiCard,
  AnalyticsSectionHeader,
  ActivityTimeline,
  GradientButton,
  OndaSelect,
  useOndaDialogs,
  AnalyticsFiltersBar,
  Collapsible,
  InsightsPanel,
  FilterChip,
  SegmentedControl,
  rangeFromPreset,
  promoTypeLabel,
  promoTypeIcon,
  api,
  toast,
  type AnalyticsFiltersValue,
  OndaIcons,
  OndaHandMark,
  BadgePill,
  SkeletonDetail,
  SkeletonDashboard,
} from "@onda/shared-ui";
import {
  displayPhone,
  formatMoneyInput,
  parseMoneyInput,
  formatCop,
} from "@onda/shared-utils";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
} from "recharts";
import { ChartBarIcon as ChartBar } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ChartLineUpIcon as ChartLineUp } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { CurrencyCircleDollarIcon as CurrencyCircleDollar } from "@phosphor-icons/react/dist/csr/CurrencyCircleDollar";
import { GiftIcon as Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { PercentIcon as Percent } from "@phosphor-icons/react/dist/csr/Percent";
import { ReceiptIcon as Receipt } from "@phosphor-icons/react/dist/csr/Receipt";
import { TargetIcon as Target } from "@phosphor-icons/react/dist/csr/Target";
import { TrendUpIcon as TrendUp } from "@phosphor-icons/react/dist/csr/TrendUp";
import { UsersThreeIcon as UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { PromoDetail } from "./PromoDetail";
import { CreatePromo } from "./CreatePromo";
import { CartillaEditor } from "./CartillaEditor";
import { CartillaCalendar } from "./CartillaCalendar";
import { CustomerDetail } from "./CustomerDetail";
import { CompareStores, type CompareResponse } from "./CompareStores";
import { PendingRequestsPanel, CajaOpenButton } from "./PendingRequestsPanel";
import { ReferralsPanel } from "./ReferralsPanel";
import { CampaignsHome } from "./CampaignsHome";
import { CampaignWizard } from "./CampaignWizard";
import { CampaignDetail } from "./CampaignDetail";
import { SetupChecklist } from "./SetupChecklist";
import { isSetupAllowedTab, storeSetupStatus } from "./setupStatus";
import { useMerchantAuth } from "../lib/MerchantAuth";
import { PosWorkspace } from "./PosWorkspace";
import { ConfigWorkspace } from "./ConfigWorkspace";
import { useStoreRole, isAdmin, cajaAllowedMerchantPath } from "../lib/useStoreRole";

type Tab =
  | "completar"
  | "resumen"
  | "comparativa"
  | "clientes"
  | "promos"
  | "campanas"
  | "eventos"
  | "referidos"
  | "config"
  | "pos"
  | "caja";

type CustomerSegment =
  | "todos"
  | "nuevos"
  | "activos"
  | "cercaCanje"
  | "enRiesgo"
  | "vip"
  | "dormidos";

// Oculto temporalmente: poner en true para reactivar el módulo.
const COMPARATIVA_ENABLED = false;
const REGISTER_STORE_ENABLED = false;
const EVENTOS_ENABLED = false;

const SECTIONS: Tab[] = [
  "completar",
  "resumen",
  ...(COMPARATIVA_ENABLED ? (["comparativa"] as const) : []),
  "clientes",
  "promos",
  "campanas",
  ...(EVENTOS_ENABLED ? (["eventos"] as const) : []),
  "referidos",
  "pos",
  "caja",
  "config",
];

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function formatRoi(roi?: number | null) {
  if (roi == null || !Number.isFinite(roi)) return "—";
  return `${roi.toFixed(1)}x`;
}

function formatMoneyAxis(v: number) {
  const n = Math.abs(Number(v));
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function MoneyChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as {
    ventas?: number;
    beneficio?: number;
    neto?: number;
    roiDia?: number | null;
  };
  const ventas = row?.ventas ?? 0;
  const beneficio = row?.beneficio ?? 0;
  const neto = row?.neto ?? ventas - beneficio;
  const roiDia = row?.roiDia;

  return (
    <div className="rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-[var(--onda-ink)]">
        {String(label || "").slice(5).replace("-", "/")}
      </p>
      <ul className="space-y-1.5">
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--onda-sky)]" />
            Ventas
          </span>
          <span className="font-medium tabular-nums">{formatCop(ventas)}</span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--onda-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--onda-primary)]" />
            Beneficio otorgado
          </span>
          <span className="font-medium tabular-nums">{formatCop(beneficio)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 border-t border-[var(--onda-border)] pt-1.5">
          <span className="text-[var(--onda-muted)]">Neto</span>
          <span
            className={`font-semibold tabular-nums ${
              neto >= 0 ? "text-[var(--onda-success)]" : "text-[var(--onda-danger)]"
            }`}
          >
            {formatCop(neto)}
          </span>
        </li>
        {roiDia != null && Number.isFinite(roiDia) ? (
          <li className="flex items-center justify-between gap-4">
            <span className="text-[var(--onda-muted)]">ROI del día</span>
            <span className="font-medium tabular-nums">{roiDia.toFixed(1)}x</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function PromoTag({
  children,
  icon,
  className = "",
}: {
  children: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

type PromoPoolKey = "BIENVENIDA" | "RETENCION";

const PROMO_POOL_OPTIONS: {
  id: PromoPoolKey;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "BIENVENIDA", label: "Adquisición", icon: OndaIcons.sparkle },
  { id: "RETENCION", label: "Retención", icon: OndaIcons.users },
];

function PromoIconBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition ${
        danger
          ? "text-[var(--onda-muted)] hover:bg-[var(--onda-danger)]/10 hover:text-[var(--onda-danger)]"
          : "text-[var(--onda-muted)] hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function promoInsightBadge(promo: any, canjes: number) {
  if (promo.needsReplacement) return "Sin stock";
  if (canjes >= 3) return "Top";
  if (canjes === 0) return "Sin tracción";
  return null;
}

function PromoCatalogCard({
  promo,
  view,
  stats,
  highlight,
  showTypeTag,
  showStatusTag,
  showPoolTag,
  onOpen,
  onToggle,
  onDelete,
}: {
  promo: any;
  view: "grid" | "list";
  stats: any;
  highlight: boolean;
  showTypeTag: boolean;
  showStatusTag: boolean;
  showPoolTag: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const canjes = stats?.canjesInRange ?? promo.redemptionCount ?? 0;
  const elegibles = stats?.elegibles ?? 0;
  const badge = promoInsightBadge(promo, canjes);
  const pool: PromoPoolKey =
    promo.pool === "BIENVENIDA" ? "BIENVENIDA" : "RETENCION";
  const poolOpt = PROMO_POOL_OPTIONS.find((o) => o.id === pool);
  const highlightCls = highlight
    ? "ring-2 ring-[var(--onda-violet)] ring-offset-2"
    : "";
  const inactiveCls = showStatusTag && !promo.isActive ? "opacity-70" : "";

  const insightTag = badge ? (
    <PromoTag
      icon={badge === "Top" ? OndaIcons.sparkle : OndaIcons.snowflake}
      className={
        badge === "Top"
          ? "bg-[var(--onda-success)] text-white"
          : "bg-amber-100 text-amber-800"
      }
    >
      {badge}
    </PromoTag>
  ) : null;

  const contextLine =
    showStatusTag && !promo.isActive
      ? "Inactiva"
      : showPoolTag
        ? poolOpt?.label
        : null;

  const statsInline = (
    <dl className="flex shrink-0 items-center gap-3 sm:gap-4">
      <div className="flex items-baseline gap-1">
        <dt className="text-[11px] text-[var(--onda-muted)]">Canjes</dt>
        <dd className="tabular-nums text-sm font-semibold text-[var(--onda-ink)]">
          {canjes}
        </dd>
      </div>
      <div className="flex items-baseline gap-1">
        <dt className="text-[11px] text-[var(--onda-muted)]">Elegibles</dt>
        <dd className="tabular-nums text-sm font-semibold text-[var(--onda-ink)]">
          {elegibles}
        </dd>
      </div>
    </dl>
  );

  const actions = (
    <div className="flex shrink-0 items-center">
      <PromoIconBtn
        label={promo.isActive ? "Desactivar" : "Activar"}
        onClick={onToggle}
      >
        {OndaIcons.power}
      </PromoIconBtn>
      <PromoIconBtn label="Eliminar" danger onClick={onDelete}>
        {OndaIcons.trash}
      </PromoIconBtn>
    </div>
  );

  if (view === "list") {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={`onda-card flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:shadow-[0_1px_2px_rgba(26,27,46,0.08)] ${highlightCls} ${inactiveCls}`}
      >
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--onda-bg)]">
          {promo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={promo.imageUrl}
              alt={promo.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center onda-gradient text-[10px] font-bold text-white">
              O
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {showTypeTag ? (
              <span className="shrink-0 text-[var(--onda-violet)]" aria-hidden>
                {promoTypeIcon(promo.type)}
              </span>
            ) : null}
            <h3 className="truncate font-display text-sm font-semibold">
              {promo.title}
            </h3>
            {insightTag}
            {contextLine ? (
              <span className="text-[11px] text-[var(--onda-muted)]">
                · {contextLine}
              </span>
            ) : null}
          </div>
        </div>
        {statsInline}
        {actions}
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`onda-card cursor-pointer overflow-hidden transition hover:shadow-[0_1px_2px_rgba(26,27,46,0.08)] ${highlightCls} ${inactiveCls}`}
    >
      <div className="relative aspect-[16/10] bg-[var(--onda-bg)]">
        {promo.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promo.imageUrl}
            alt={promo.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center onda-gradient text-sm font-bold text-white/90">
            Onda
          </div>
        )}
        {insightTag ? (
          <div className="absolute left-1.5 top-1.5">{insightTag}</div>
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1">
          {showTypeTag ? (
            <span
              className="shrink-0 text-[var(--onda-violet)]"
              aria-hidden
            >
              {promoTypeIcon(promo.type)}
            </span>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate font-display text-xs font-semibold leading-tight">
            {promo.title}
          </h3>
          {actions}
        </div>
        {contextLine ? (
          <p className="mt-0.5 text-[10px] leading-none text-[var(--onda-muted)]">
            {contextLine}
          </p>
        ) : null}
        <dl className="mt-1.5 flex items-center gap-3">
          <div className="flex min-w-0 items-baseline gap-1">
            <dt className="text-[10px] font-medium text-[var(--onda-muted)]">
              Canjes
            </dt>
            <dd className="tabular-nums text-xs font-semibold text-[var(--onda-ink)]">
              {canjes}
            </dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-1">
            <dt className="text-[10px] font-medium text-[var(--onda-muted)]">
              Elegibles
            </dt>
            <dd className="tabular-nums text-xs font-semibold text-[var(--onda-ink)]">
              {elegibles}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

type PulseTone = "good" | "ok" | "warn" | "bad" | "neutral";

/** Usa `{period}` para insertar el hint de fechas (hoy, esta semana…). */
const PULSE_COPY: Record<
  "good" | "ok" | "warn" | "bad" | "empty",
  { titles: string[]; lines: string[] }
> = {
  good: {
    titles: [
      "Va viento en popa {period}",
      "Qué buen ritmo {period}",
      "El programa brilla {period}",
      "Se nota el jalón {period}",
      "Onda a todo vapor {period}",
      "Cliente contento, tú contento {period}",
      "Esto sí está prendido {period}",
      "Números que dan gusto {period}",
      "La lealtad está trabajando {period}",
      "Buenas vibras en caja {period}",
      "El pase se siente vivo {period}",
      "Vas ganando terreno {period}",
    ],
    lines: [
      "La gente está acumulando y canjeando. Sigue así, el programa se siente vivo.",
      "Hay flujo de ondas y canjes. Mantén el QR a la vista y no aflojes el ritmo.",
      "Acumulan, canjean y vuelven. Eso es un programa que ya enganchó.",
      "Buen equilibrio entre sumar y redimir. Estás en zona saludable.",
      "Se ve movimiento real, no solo números bonitos. Sigue empujando en caja.",
      "Los clientes están jugando el juego. Cuida el catálogo para no perder el momentum.",
      "Ondas y canjes al alza: el pase está haciendo su chamba.",
      "Periodo sólido. Si quieres aún más canjes, un gancho de 3–5 ondas ayuda.",
      "La dinámica se siente cálida. Buen momento para destacar una promo estrella.",
      "Vas por buen camino: hay actividad y la gente responde.",
      "El programa no está dormido. Celebra el ritmo y no cambies lo que funciona.",
      "Hay tracción. Un WhatsApp suave a los más activos puede multiplicar canjes.",
    ],
  },
  ok: {
    titles: [
      "Va tirando {period}",
      "Ni fu ni fa {period}",
      "Estable, sin drama {period}",
      "En modo crucero {period}",
      "Sin sorpresas {period}",
      "Todo en promedio {period}",
      "Marcha normal {period}",
      "Se sostiene {period}",
      "Ni pico ni valle {period}",
      "Ritmo de diario {period}",
      "Pasable {period}",
      "En equilibrio flojo {period}",
    ],
    lines: [
      "Números estables. Nada alarmante, tampoco un festín.",
      "Hay movimiento, pero nada que grite victoria. Un empujoncito vendría bien.",
      "Se mantiene a flote. Si quieres más brillo, prueba una promo fácil de canjear.",
      "Periodo correcto, sin picos. Buen momento para experimentar sin miedo.",
      "Ni sube fuerte ni se cae. El piso está firme; falta el impulso.",
      "Actividad regular. Revisa si el catálogo motiva o solo acumulan por inercia.",
      "Va en línea. Un recordatorio en caja puede convertir ondas en canjes.",
      "Está vivo, pero en modo bajo. No está roto; está pidiendo atención.",
      "Resultados tibios. No es mala señal, solo invitación a activar algo.",
      "Se siente el día a día. Si buscas un salto, cambia el gancho de la promo.",
      "Sin alarmas. Mantén el QR visible y mira qué promo responde mejor.",
      "Equilibrio suave. Un empujón a clientes cerca de canje puede mover la aguja.",
    ],
  },
  warn: {
    titles: [
      "Anda flojo {period}",
      "Se enfría un poco {period}",
      "Ojo, baja la temperatura {period}",
      "Ritmo más apagado {period}",
      "Hay señales de enfriamiento {period}",
      "No está en su mejor día {period}",
      "Le falta chispa {period}",
      "Va a medio gas {period}",
      "El impulso se afloja {period}",
      "Periodo tibio-frío {period}",
      "Conviene poner atención {period}",
      "No lo dejes pasar {period}",
    ],
    lines: [
      "Bajaron ondas y canjes. Revisa el QR/caja o lanza un gancho fácil de canjear.",
      "Acumulan, pero casi no canjean. El catálogo puede no estar motivando.",
      "Hay señales de enfriamiento. Un empujoncito (promo o WhatsApp) no estaría de más.",
      "Menos tracción que antes. Confirma que el equipo está sumando en cada ticket.",
      "El programa respira más despacio. Una promo corta y clara puede reactivar.",
      "Se siente flojo. Revisa si alguna promo se quedó sin cupo o sin brillo.",
      "Los números pedalean cuesta abajo. Activa algo simple de 3–5 ondas.",
      "No es derrumbe, pero sí desaceleración. Mejor intervenir ya que después.",
      "Menos canjes de lo esperado. Pregunta en caja qué están pidiendo los clientes.",
      "El hábito se afloja. Un recordatorio a los dormidos puede ayudar.",
      "Hay movimiento, pero flojo frente al periodo anterior. Empuja una promo visible.",
      "Toca despertar el pase: QR a la vista, promo fácil y un empujón al equipo.",
    ],
  },
  bad: {
    titles: [
      "Va mal {period}",
      "Se siente apagado {period}",
      "Periodo en rojo {period}",
      "El programa está quieto {period}",
      "Poco latido {period}",
      "Esto pide reacción {period}",
      "Anda en modo silencio {period}",
      "Se cayó el ritmo {period}",
      "Alerta en el tablero {period}",
      "No está funcionando {period}",
      "Hay que intervenir ya {period}",
      "El pase casi no respira {period}",
    ],
    lines: [
      "Poco movimiento y peores números que antes. Actúa en caja y en el catálogo.",
      "Casi no hay ondas ni canjes. Revisa QR y que el equipo sume en cada venta.",
      "Se siente apagado. Lanza algo inmediato: promo fácil y visible en mostrador.",
      "Los números piden SOS. Duplica una promo que ya funcionó o crea un gancho nuevo.",
      "Muy poca vida en el programa. Confirma que los clientes encuentran cómo acumular.",
      "Periodo flojo de verdad. Prioriza reactivar canjes antes de inventar complejidad.",
      "La lealtad no está pegando. Simplifica el beneficio y empuja en caja hoy.",
      "Casi no hay tracción. Un WhatsApp a clientes con ondas puede destrabar canjes.",
      "Los datos no mienten: hay que reaccionar. Empieza por lo más fácil de canjear.",
      "El programa está frío. Revisa operación diaria y dale un empujón fuerte a promos.",
      "Sin ritmo claro. Amplía fechas solo para contexto; si no, actúa ya en caja.",
      "Se nota el vacío. Activa una promo estrella y asegúrate de que se ofrezca en cada ticket.",
    ],
  },
  empty: {
    titles: [
      "Por acá no hay movimiento",
      "Filtros sin historia",
      "Todo en silencio",
      "Nada que contar aún",
      "Pantalla en blanco (casi)",
      "Sin ondas ni canjes",
      "Vacío en este recorte",
      "No aparece actividad",
      "Este rango está quieto",
      "Cero movimiento útil",
      "Sin señales en el radar",
      "Aquí no hay pelea",
    ],
    lines: [
      "Con estos filtros no aparece casi nada. Prueba ampliar las fechas o quitar filtros de promo.",
      "El recorte quedó vacío. Afloja un filtro o mira un periodo más amplio.",
      "No hay datos para este corte. Cambia fechas o tipos de promo y vuelve a mirar.",
      "Silencio total en el rango. Puede ser filtro agresivo o un día sin operación.",
      "Nada que graficar aquí. Amplía el periodo para ver si hay vida afuera.",
      "Sin ondas ni canjes en esta vista. Revisa si el filtro de tipo promo está muy cerrado.",
      "Este zoom no muestra historia. Abre el rango o quita chips de filtro.",
      "Vacío útil: o no hubo actividad, o el filtro la escondió. Prueba otro preset.",
      "No hay métricas en este recorte. Cambia a 7 o 14 días para tener contexto.",
      "La consulta no trajo movimiento. Ajusta fechas antes de alarmarte.",
      "Sin puntos en la serie. Prueba quitar filtros y comparar con el mes.",
      "Aquí no hay pelea todavía. Amplía y vuelve: a veces el filtro es el culpable.",
    ],
  },
};

const PULSE_LOW_PROMO_LINES = [
  (hint: string) =>
    `No está mal, pero ojo: ${hint}. Conviene duplicar o crear otra.`,
  (hint: string) =>
    `Hay piso, aunque ${hint}. No dejes que se apague el catálogo.`,
  (hint: string) =>
    `Se sostiene, pero ${hint}. Un duplicado rápido evita el hueco.`,
  (hint: string) =>
    `Números correctos; igual ${hint}. Mejor adelantarte que improvisar.`,
  (hint: string) =>
    `Va tirando, y encima ${hint}. Toca preparar el relevo de esa promo.`,
  (hint: string) =>
    `Sin drama en KPIs, pero ${hint}. El stock de beneficios importa.`,
  (hint: string) =>
    `Estable… hasta que miras promos: ${hint}. Actúa antes del vacío.`,
  (hint: string) =>
    `El ritmo aguanta, aunque ${hint}. Duplica o crea algo fresco.`,
  (hint: string) =>
    `Ok en lo general, pero ${hint}. No esperes a que se acabe del todo.`,
  (hint: string) =>
    `Se siente apagado y además ${hint}. Reacciona: duplica o lanza otra ya.`,
  (hint: string) =>
    `Poco latido y ${hint}. Prioriza catálogo antes de perder canjes.`,
  (hint: string) =>
    `Hay que intervenir: ${hint}. Sin beneficio claro, el pase se enfría.`,
];

function pickPulse<T>(items: T[], seed: number, salt: number): T {
  const i = Math.abs(Math.floor(seed * 10_000 + salt * 97)) % items.length;
  return items[i]!;
}

function fillPeriod(template: string, periodHint: string) {
  return template.replaceAll("{period}", periodHint);
}

function buildStorePublicUrl(slug: string) {
  const pwa = (
    process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:4201"
  ).replace(/\/$/, "");
  return `${pwa}/r/${slug}`;
}

type WompiCheckout = {
  reference: string;
  amountInCents: number;
  currency: string;
  publicKey: string;
  integrity: string;
  redirectUrl: string;
};

declare global {
  interface Window {
    WidgetCheckout?: new (opts: {
      currency: string;
      amountInCents: number;
      reference: string;
      publicKey: string;
      signature: { integrity: string };
      redirectUrl?: string;
    }) => {
      open: (
        cb: (result: { transaction?: { status?: string } }) => void,
      ) => void;
    };
  }
}

function loadWompiWidget(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.WidgetCheckout) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://checkout.wompi.co/widget.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Wompi")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.wompi.co/widget.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Wompi"));
    document.head.appendChild(script);
  });
}

function formatCartillaRange(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return "Sin fechas aún";
  const fmt = (iso: string) => {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
      .replace(".", "");
  };
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

function parseRoute(pathname: string): {
  tab: Tab;
  promoId: string | null;
  customerPassId: string | null;
  cartillaId: string | null;
  campaignNew: boolean;
  campaignId: string | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  const raw = parts[0] || "resumen";
  if (raw === "pos") {
    return {
      tab: "pos",
      promoId: null,
      customerPassId: null,
      cartillaId: null,
      campaignNew: false,
      campaignId: null,
    };
  }
  if (raw === "caja" || raw === "operacion") {
    return {
      tab: "caja",
      promoId: null,
      customerPassId: null,
      cartillaId: null,
      campaignNew: false,
      campaignId: null,
    };
  }
  if (raw === "cartillas") {
    return {
      tab: "promos",
      promoId: null,
      customerPassId: null,
      cartillaId: parts[1] && parts[1] !== "calendario" ? parts[1] : null,
      campaignNew: false,
      campaignId: null,
    };
  }
  const section = (raw === "pase" ? "config" : raw) as Tab;
  const tab = SECTIONS.includes(section) ? section : "resumen";
  let promoId: string | null = null;
  let cartillaId: string | null = null;
  if (tab === "promos") {
    if (parts[1] === "cartilla") {
      cartillaId = parts[2] && parts[2] !== "calendario" ? parts[2] : null;
    } else if (parts[1]) {
      promoId = parts[1];
    }
  }
  const customerPassId = tab === "clientes" && parts[1] ? parts[1] : null;
  const campaignNew = tab === "campanas" && parts[1] === "nueva";
  const campaignId =
    tab === "campanas" && parts[1] && parts[1] !== "nueva" ? parts[1] : null;
  return { tab, promoId, customerPassId, cartillaId, campaignNew, campaignId };
}

const POS_METHOD_OPTIONS = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" },
] as const;

export function MerchantWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const { firebaseEnabled, logout } = useMerchantAuth();
  const {
    tab,
    promoId: selectedPromoId,
    customerPassId: selectedCustomerPassId,
    cartillaId: selectedCartillaId,
    campaignNew,
    campaignId,
  } = parseRoute(pathname);

  useEffect(() => {
    if (pathname === "/pase" || pathname.startsWith("/pase/")) {
      router.replace("/config");
    }
    if (pathname === "/cartillas" || pathname === "/cartillas/") {
      router.replace("/promos");
    } else if (pathname.startsWith("/cartillas/")) {
      const rest = pathname.slice("/cartillas/".length);
      router.replace(`/promos/cartilla/${rest}`);
    }
    if (pathname === "/promos/cartilla/calendario") {
      router.replace("/promos");
    }
    if (
      !EVENTOS_ENABLED &&
      (pathname === "/eventos" || pathname.startsWith("/eventos/"))
    ) {
      router.replace("/resumen");
    }
    if (pathname === "/operacion" || pathname.startsWith("/operacion/")) {
      router.replace("/caja");
    }
    if (pathname === "/actividad" || pathname.startsWith("/actividad/")) {
      router.replace("/resumen");
    }
  }, [pathname, router]);

  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState<"global" | "event">("global");
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [duplicateSource, setDuplicateSource] = useState<any>(null);
  const [justCreatedPromoId, setJustCreatedPromoId] = useState<string | null>(
    null,
  );
  const [promoView, setPromoView] = useState<"grid" | "list">("grid");
  const [showPulse, setShowPulse] = useState(true);
  const [promoStatusFilter, setPromoStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [promoPoolFilter, setPromoPoolFilter] = useState<
    "ALL" | "BIENVENIDA" | "RETENCION"
  >("ALL");
  const [cartillasData, setCartillasData] = useState<any>(null);
  const [promoDetail, setPromoDetail] = useState<any>(null);
  const [promoDetailLoading, setPromoDetailLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [segment, setSegment] = useState<CustomerSegment>("todos");
  const [compareStoreIds, setCompareStoreIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [storesReady, setStoresReady] = useState(false);
  const [storeCurrency, setStoreCurrency] = useState("COP");
  const [storeOndaValue, setStoreOndaValue] = useState("");
  const [storeLogoUrl, setStoreLogoUrl] = useState("");
  const [savingStoreLogo, setSavingStoreLogo] = useState(false);
  const [savingStoreEconomics, setSavingStoreEconomics] = useState(false);
  const { confirm, alert, dialogs } = useOndaDialogs();

  const initialRange = rangeFromPreset("14d");
  const [filters, setFilters] = useState<AnalyticsFiltersValue>({
    preset: "14d",
    from: initialRange.from,
    to: initialRange.to,
    promoTypes: [],
  });
  const [posPaymentMethods, setPosPaymentMethods] = useState<string[]>([]);

  const store = stores.find((s) => s.id === storeId);
  const storeName =
    (typeof store?.name === "string" && store.name.trim()) ||
    (typeof stores[0]?.name === "string" && stores[0].name.trim()) ||
    "";
  const setup = useMemo(() => storeSetupStatus(store), [store]);

  useEffect(() => {
    document.title = storeName
      ? `Onda - ${storeName}`
      : "Onda - Panel del negocio";
  }, [storeName]);

  useEffect(() => {
    setStoreCurrency(store?.currency || "COP");
    setStoreOndaValue(store?.ondaValue != null ? String(store.ondaValue) : "");
    setStoreLogoUrl(store?.passDesign?.logoUrl || "");
  }, [store?.id, store?.currency, store?.ondaValue, store?.passDesign?.logoUrl]);
  const showSetupNav = storesReady && stores.length > 0 && !setup.complete;
  const kpis = overview?.kpis;
  const customers = overview?.customers || [];
  const memberRole = useStoreRole(stores, storeId);
  const admin = isAdmin(memberRole);

  const navClusters = useMemo((): NavCluster[] => {
    if (showSetupNav) {
      return [
        {
          id: "setup",
          items: [
            {
              href: "/completar",
              label: "Completar",
              icon: OndaIcons.check,
              active: tab === "completar",
            },
            {
              href: "/promos",
              label: "Promociones",
              icon: OndaIcons.redeem,
              active: tab === "promos",
            },
            {
              href: "/config",
              label: "Configuración",
              icon: OndaIcons.gear,
              active: tab === "config",
              footer: true,
            },
          ],
        },
      ];
    }

    const loyaltyItems = admin
      ? [
          {
            href: "/resumen",
            label: "Resumen",
            icon: OndaIcons.chart,
            active: tab === "resumen",
          },
          ...(COMPARATIVA_ENABLED && stores.length >= 2
            ? [
                {
                  href: "/comparativa",
                  label: "Comparativa",
                  icon: OndaIcons.target,
                  active: tab === "comparativa",
                },
              ]
            : []),
          {
            href: "/clientes",
            label: "Clientes",
            icon: OndaIcons.users,
            active: tab === "clientes",
          },
          {
            href: "/promos",
            label: "Promociones",
            icon: OndaIcons.redeem,
            active: tab === "promos",
          },
          {
            href: "/campanas",
            label: "Campañas",
            icon: OndaIcons.megaphone,
            active: tab === "campanas",
          },
          ...(EVENTOS_ENABLED
            ? [
                {
                  href: "/eventos",
                  label: "Eventos",
                  icon: OndaIcons.ticket,
                  active: tab === "eventos",
                },
              ]
            : []),
          {
            href: "/referidos",
            label: "Referidos",
            icon: OndaIcons.users,
            active: tab === "referidos",
          },
        ]
      : [];

    const posEnabled = Boolean(stores.find((s) => s.id === storeId)?.posEnabled);

    const posItems = posEnabled
      ? [
          ...(admin
            ? [
                {
                  href: "/pos",
                  label: "Resumen POS",
                  icon: OndaIcons.chart,
                  active: pathname === "/pos" || pathname === "/pos/",
                },
              ]
            : []),
          {
            href: "/pos/vender",
            label: "Vender",
            icon: OndaIcons.accumulate,
            active: pathname.startsWith("/pos/vender"),
          },
          ...(admin
            ? [
                {
                  href: "/pos/inventario",
                  label: "Inventario",
                  icon: OndaIcons.product,
                  active: pathname.startsWith("/pos/inventario"),
                },
              ]
            : []),
          {
            href: "/pos/ventas",
            label: "Ventas",
            icon: OndaIcons.wallet,
            active: pathname.startsWith("/pos/ventas"),
          },
        ]
      : [];

    const footerItems = admin
      ? [
          {
            href: "/config",
            label: "Configuración",
            icon: OndaIcons.gear,
            active: tab === "config",
            footer: true,
          },
        ]
      : [];

    const clusters: NavCluster[] = [];
    if (loyaltyItems.length) {
      clusters.push({ id: "loyalty", label: "Lealtad", items: loyaltyItems });
    }
    if (posItems.length) {
      clusters.push({ id: "pos", label: "POS", items: posItems });
    }
    if (footerItems.length) {
      clusters.push({ id: "footer", items: footerItems });
    }
    return clusters;
  }, [tab, stores, storeId, showSetupNav, admin, pathname]);

  const viewTitle = useMemo(() => {
    const active = navClusters
      .flatMap((c) => c.items)
      .find((item) => item.active);
    return active?.label || storeName || "Panel";
  }, [navClusters, storeName]);

  const isPosArea =
    pathname.startsWith("/pos") || pathname.startsWith("/caja");
  const isPosSummary = pathname === "/pos" || pathname === "/pos/";
  const posEnabled = Boolean(store?.posEnabled);

  function togglePosPaymentMethod(key: string) {
    setPosPaymentMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
    });
    if (mode === "event" && eventId) params.set("eventId", eventId);
    if (filters.promoTypes.length)
      params.set("promoTypes", filters.promoTypes.join(","));
    return params.toString();
  }, [filters.from, filters.to, filters.promoTypes, mode, eventId]);

  const loadOverview = useCallback(async () => {
    if (!storeId) return;
    const data = await api(
      `/analytics/store/${storeId}/overview?${overviewQuery}`,
    );
    setOverview(data);
  }, [storeId, overviewQuery]);

  const loadPromos = useCallback(async () => {
    if (!storeId) return;
    const params = new URLSearchParams({ storeId });
    if (filters.promoTypes.length)
      params.set("type", filters.promoTypes.join(","));
    if (promoStatusFilter === "active") params.set("isActive", "true");
    if (promoStatusFilter === "inactive") params.set("isActive", "false");
    if (promoPoolFilter !== "ALL") params.set("pool", promoPoolFilter);
    setPromos((await api(`/promotions?${params}`)) as any[]);
  }, [storeId, filters.promoTypes, promoStatusFilter, promoPoolFilter]);

  const loadCartillas = useCallback(async () => {
    if (!storeId) return;
    const data = await api<any>(`/cartillas?storeId=${storeId}`);
    setCartillasData(data);
    const def =
      (data?.cartillas || []).find((c: any) => c.isDefault) ||
      data?.cartillas?.[0];
    if (!def) return;
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? {
              ...s,
              cartillas: [
                {
                  id: def.id,
                  isDefault: true,
                  _count: { items: def.items?.length ?? 0 },
                },
              ],
            }
          : s,
      ),
    );
  }, [storeId]);

  const loadCustomerDetail = useCallback(async () => {
    if (!storeId || !selectedCustomerPassId) return;
    const q = new URLSearchParams({
      from: filters.from,
      to: filters.to,
    });
    try {
      setCustomerDetailLoading(true);
      setCustomerDetail(
        await api(
          `/analytics/store/${storeId}/customers/${selectedCustomerPassId}?${q}`,
        ),
      );
    } catch {
      setCustomerDetail(null);
    } finally {
      setCustomerDetailLoading(false);
    }
  }, [storeId, selectedCustomerPassId, filters.from, filters.to]);

  const loadPromoDetail = useCallback(async () => {
    if (!selectedPromoId || selectedPromoId === "nueva") return;
    const q = new URLSearchParams({
      from: filters.from,
      to: filters.to,
    });
    try {
      setPromoDetailLoading(true);
      setPromoDetail(
        await api(`/promotions/${selectedPromoId}/analytics?${q}`),
      );
    } catch {
      setPromoDetail(null);
    } finally {
      setPromoDetailLoading(false);
    }
  }, [selectedPromoId, filters.from, filters.to]);

  const activityRefreshTimer = useRef<number>(0);
  const refreshAfterStoreActivity = useCallback(() => {
    window.clearTimeout(activityRefreshTimer.current);
    activityRefreshTimer.current = window.setTimeout(() => {
      void loadOverview();
      void loadCartillas();
      void loadPromos();
      if (selectedCustomerPassId) void loadCustomerDetail();
      if (selectedPromoId && selectedPromoId !== "nueva") void loadPromoDetail();
    }, 250);
  }, [
    loadOverview,
    loadCartillas,
    loadPromos,
    loadCustomerDetail,
    loadPromoDetail,
    selectedCustomerPassId,
    selectedPromoId,
  ]);

  useEffect(() => {
    return () => window.clearTimeout(activityRefreshTimer.current);
  }, []);

  useEffect(() => {
    api<any[]>("/auth/merchant/stores").then((list) => {
      setStores(list);
      let preferred = "";
      try {
        preferred = localStorage.getItem("onda-merchant-store-id") || "";
      } catch {
        /* ignore */
      }
      const initial =
        list.find((s) => s.id === preferred)?.id || list[0]?.id || "";
      if (initial) setStoreId(initial);
      setCompareStoreIds(list.map((s) => s.id));
      setStoresReady(true);
    });
    api<any[]>("/events").then((list) => {
      setEvents(list);
      if (list[0]) setEventId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!storesReady || admin) return;
    if (memberRole !== "CAJA") return;
    if (!cajaAllowedMerchantPath(pathname)) {
      router.replace(posEnabled ? "/pos/vender" : "/caja");
    }
  }, [storesReady, admin, memberRole, pathname, router, posEnabled]);

  useEffect(() => {
    if (!storesReady) return;
    if (tab === "comparativa" && stores.length < 2) {
      router.replace(admin ? "/resumen" : posEnabled ? "/pos/vender" : "/caja");
    }
  }, [tab, stores.length, storesReady, router, admin, posEnabled]);

  const setupWasComplete = useRef<boolean | null>(null);

  useEffect(() => {
    setupWasComplete.current = null;
  }, [storeId]);

  useEffect(() => {
    if (!storesReady || !storeId || stores.length === 0) return;
    if (!setup.complete && !isSetupAllowedTab(tab)) {
      router.replace("/completar");
    } else if (setup.complete && tab === "completar") {
      router.replace(
        memberRole === "CAJA"
          ? posEnabled
            ? "/pos/vender"
            : "/caja"
          : "/resumen",
      );
    }
    if (setupWasComplete.current === false && setup.complete) {
      toast.success("Tu negocio ya está listo", {
        description: "Ya puedes usar el panel completo.",
      });
      router.replace(
        memberRole === "CAJA"
          ? posEnabled
            ? "/pos/vender"
            : "/caja"
          : "/resumen",
      );
    }
    setupWasComplete.current = setup.complete;
  }, [
    storesReady,
    storeId,
    stores.length,
    setup.complete,
    tab,
    router,
    memberRole,
    posEnabled,
  ]);

  const loadCompare = useCallback(async () => {
    if (!compareStoreIds.length) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const params = new URLSearchParams({
        storeIds: compareStoreIds.join(","),
        from: filters.from,
        to: filters.to,
      });
      const data = await api<CompareResponse>(
        `/analytics/stores/compare?${params}`,
      );
      setCompare(data);
    } catch (e) {
      setCompare(null);
      setCompareError(
        e instanceof Error ? e.message : "No se pudo cargar la comparativa",
      );
    } finally {
      setCompareLoading(false);
    }
  }, [compareStoreIds, filters.from, filters.to]);

  useEffect(() => {
    if (tab !== "comparativa") return;
    loadCompare();
  }, [tab, loadCompare]);

  function openCompareStore(id: string) {
    setStoreId(id);
    router.push("/resumen");
  }

  useEffect(() => {
    if (!storeId) return;
    loadOverview();
    loadPromos();
    loadCartillas();
    api<any[]>(`/memberships?storeId=${storeId}`).then(setMemberships);
    api(`/billing/store/${storeId}`).then(setBilling);
  }, [storeId, mode, eventId, loadOverview, loadPromos, loadCartillas]);

  useEffect(() => {
    if (!selectedPromoId || selectedPromoId === "nueva") {
      setPromoDetail(null);
      return;
    }
    void loadPromoDetail();
  }, [selectedPromoId, loadPromoDetail]);

  useEffect(() => {
    if (!justCreatedPromoId) return;
    const t = setTimeout(() => setJustCreatedPromoId(null), 4000);
    return () => clearTimeout(t);
  }, [justCreatedPromoId]);

  useEffect(() => {
    if (selectedPromoId !== "nueva") setDuplicateSource(null);
  }, [selectedPromoId]);

  useEffect(() => {
    if (!selectedCustomerPassId || !storeId) {
      setCustomerDetail(null);
      return;
    }
    void loadCustomerDetail();
  }, [selectedCustomerPassId, storeId, loadCustomerDetail]);

  function openPromoDetail(id: string) {
    router.push(`/promos/${id}`);
  }

  function closePromoDetail() {
    setPromoDetail(null);
    router.push("/promos");
  }

  function closeCreatePromo() {
    setDuplicateSource(null);
    router.push(setup.complete ? "/promos" : "/completar");
  }

  async function handlePromoCreated(promo: any) {
    await loadPromos();
    await loadOverview();
    setJustCreatedPromoId(promo.id);
    setDuplicateSource(null);
    const nextCount = (store?._count?.promotions ?? 0) + 1;
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId ? { ...s, _count: { promotions: nextCount } } : s,
      ),
    );
    router.push("/promos");
  }

  function openCustomerDetail(passId: string) {
    router.push(`/clientes/${passId}`);
  }

  function closeCustomerDetail() {
    setCustomerDetail(null);
    router.push("/clientes");
  }

  const filteredCustomers = useMemo(() => {
    if (segment === "todos") return customers;
    return customers.filter((c: any) => {
      if (segment === "nuevos") return c.badge === "Nuevo";
      if (segment === "activos") return c.visitsInRange > 0;
      if (segment === "cercaCanje") return c.nearPromo && c.nearPromo.gap <= 2;
      if (segment === "enRiesgo") return c.badge === "En riesgo";
      if (segment === "vip") return c.badge === "VIP";
      if (segment === "dormidos") return c.badge === "Dormido";
      return true;
    });
  }, [customers, segment]);

  const promoStatsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of overview?.promoStats || []) map.set(p.id, p);
    return map;
  }, [overview?.promoStats]);

  const emptyRange =
    overview &&
    (overview.kpis?.ondas ?? 0) === 0 &&
    (overview.kpis?.redenciones ?? 0) === 0 &&
    (overview.series || []).every((r: any) => !r.ondas && !r.canjes);

  const emptyMoneyRange =
    overview &&
    (overview.kpis?.ventas ?? 0) === 0 &&
    (overview.kpis?.beneficioOtorgado ?? 0) === 0 &&
    (overview.series || []).every(
      (r: any) => !(r.ventas ?? 0) && !(r.beneficio ?? 0),
    );

  const moneySeries = useMemo(
    () =>
      (overview?.series || []).map((row: any) => {
        const ventas = row.ventas ?? 0;
        const beneficio = row.beneficio ?? 0;
        const neto = ventas - beneficio;
        return {
          ...row,
          neto,
          roiDia: beneficio > 0 ? ventas / beneficio : null,
        };
      }),
    [overview?.series],
  );

  const moneyNeto = (kpis?.ventas ?? 0) - (kpis?.beneficioOtorgado ?? 0);

  const filterPulseKey = `${filters.preset}|${filters.from}|${filters.to}|${filters.promoTypes.join(",")}`;
  const [pulseSeed, setPulseSeed] = useState(() => Math.random());
  const [pulseFilterKey, setPulseFilterKey] = useState(filterPulseKey);
  if (pulseFilterKey !== filterPulseKey) {
    setPulseFilterKey(filterPulseKey);
    setPulseSeed(Math.random());
  }

  const pulse = useMemo(() => {
    if (!overview) {
      return {
        tone: "neutral" as PulseTone,
        title: "Cargando el panorama…",
        line: "Un momento mientras armamos el resumen.",
      };
    }

    const periodHint =
      filters.preset === "today"
        ? "hoy"
        : filters.preset === "7d"
          ? "esta semana"
          : filters.preset === "14d"
            ? "estas dos semanas"
            : filters.preset === "30d"
              ? "este mes (aprox.)"
              : filters.preset === "month"
                ? "este mes"
                : "este periodo";

    if (emptyRange) {
      const pack = PULSE_COPY.empty;
      return {
        tone: "neutral" as PulseTone,
        title: pickPulse(pack.titles, pulseSeed, 1),
        line: pickPulse(pack.lines, pulseSeed, 2),
      };
    }

    const ondasD = kpis?.ondasDelta ?? 0;
    const redeemD = kpis?.redencionesDelta ?? 0;
    const newD = kpis?.clientesNuevosDelta ?? 0;
    const rate = kpis?.tasaRedencion ?? 0;
    const lowPromo = (overview.insights || []).find(
      (i: any) =>
        String(i.id).startsWith("promo-low-") ||
        String(i.id).startsWith("promo-expiring-"),
    );

    let score = 0;
    if (ondasD >= 10) score += 2;
    else if (ondasD >= 0) score += 1;
    else if (ondasD <= -25) score -= 2;
    else score -= 1;

    if (redeemD >= 10) score += 2;
    else if (redeemD >= 0) score += 1;
    else if (redeemD <= -25) score -= 2;
    else score -= 1;

    if (newD >= 0) score += 1;
    else score -= 1;

    if (rate >= 20) score += 1;
    if (lowPromo) score -= 1;

    const tone: PulseTone =
      score >= 3 ? "good" : score >= 0 ? "ok" : score >= -3 ? "warn" : "bad";
    const pack = PULSE_COPY[tone];
    const title = fillPeriod(pickPulse(pack.titles, pulseSeed, 3), periodHint);

    let line = pickPulse(pack.lines, pulseSeed, 4);
    if (lowPromo && (tone === "ok" || tone === "warn" || tone === "bad")) {
      const hint = String(
        lowPromo.title || "se te acaban promos",
      ).toLowerCase();
      line = pickPulse(PULSE_LOW_PROMO_LINES, pulseSeed, 5)(hint);
    }

    return { tone, title, line };
  }, [overview, emptyRange, kpis, filters.preset, pulseSeed]);

  async function saveStoreLogo(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setSavingStoreLogo(true);
    try {
      const updated = await api<any>(`/pass-designs/store/${storeId}`, {
        method: "PUT",
        body: JSON.stringify({
          logoUrl: storeLogoUrl.trim() || null,
          title: store?.name,
        }),
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === storeId
            ? { ...s, passDesign: { ...s.passDesign, logoUrl: updated.logoUrl } }
            : s,
        ),
      );
      toast.success("Logo del negocio guardado");
    } catch (err: any) {
      await alert({
        title: "No se pudo guardar el logo",
        message: err.message || "Intenta de nuevo.",
        tone: "danger",
      });
    } finally {
      setSavingStoreLogo(false);
    }
  }

  async function saveStoreEconomics(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setSavingStoreEconomics(true);
    try {
      const updated = await api<any>(`/stores/${storeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          currency: storeCurrency || "COP",
          ondaValue: storeOndaValue === "" ? null : Number(storeOndaValue),
        }),
      });
      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, ...updated } : s)),
      );
      toast.success("Configuración guardada");
    } catch (err: any) {
      await alert({
        title: "No se pudo guardar",
        message: err.message || "Intenta de nuevo.",
        tone: "danger",
      });
    } finally {
      setSavingStoreEconomics(false);
    }
  }

  async function shareStoreUrl() {
    if (!store?.slug) return;
    const url = buildStorePublicUrl(store.slug);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: store.name,
          text: `Suma ondas en ${store.name}`,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", {
        description: url,
      });
    } catch {
      await alert({
        title: "Link del negocio",
        message: url,
      });
    }
  }

  async function upgrade() {
    const ok = await confirm({
      title: "Upgrade a PRO",
      message: "Se abrirá el checkout de Wompi para activar PRO ($69.900/mes).",
      confirmLabel: "Continuar",
      tone: "accent",
    });
    if (!ok) return;
    const res = await api<{
      stub?: boolean;
      checkout?: WompiCheckout | null;
    }>(`/billing/store/${storeId}/upgrade`, { method: "POST" });
    if (res.stub || !res.checkout) {
      setBilling(await api(`/billing/store/${storeId}`));
      await alert({
        title: "Plan actualizado",
        message: "La sede ahora está en plan PRO (modo desarrollo, sin cobro).",
        tone: "success",
      });
      return;
    }
    try {
      await loadWompiWidget();
      if (!window.WidgetCheckout) {
        throw new Error("Widget Wompi no disponible");
      }
      const checkout = new window.WidgetCheckout({
        currency: res.checkout.currency,
        amountInCents: res.checkout.amountInCents,
        reference: res.checkout.reference,
        publicKey: res.checkout.publicKey,
        signature: { integrity: res.checkout.integrity },
        redirectUrl: res.checkout.redirectUrl,
      });
      checkout.open(async (result) => {
        if (result?.transaction?.status === "APPROVED") {
          setBilling(await api(`/billing/store/${storeId}`));
          await alert({
            title: "Pago aprobado",
            message:
              "La sede queda en plan PRO cuando Wompi confirme el webhook.",
            tone: "success",
          });
        }
      });
    } catch (err) {
      await alert({
        title: "No se pudo abrir Wompi",
        message: err instanceof Error ? err.message : "Intenta de nuevo",
        tone: "danger",
      });
    }
  }

  function duplicatePromo(source: any) {
    setPromoDetail(null);
    setDuplicateSource(source);
    router.push("/promos/nueva");
  }

  async function movePromoPool(promo: any, next: PromoPoolKey) {
    if (!promo?.id || promo.pool === next) return;
    if (promo.locked) {
      await alert({
        title: "No se puede mover",
        message: "Esta promo ya fue redimida. Duplica y cambia una condición.",
        tone: "warning",
      });
      return;
    }
    if (!promo.canMovePool) {
      await alert({
        title: "No se puede mover",
        message:
          "Ya hay clientes en una cartilla con esta promo. Duplica y cambia una condición.",
        tone: "warning",
      });
      return;
    }
    try {
      await api(`/promotions/${promo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pool: next }),
      });
      toast.success(
        next === "BIENVENIDA" ? "Movida a Adquisición" : "Movida a Retención",
      );
      await loadPromos();
      if (selectedPromoId === promo.id) {
        const q = new URLSearchParams({
          from: filters.from,
          to: filters.to,
        });
        setPromoDetail(await api(`/promotions/${promo.id}/analytics?${q}`));
      }
    } catch (err: any) {
      toast.danger("No se pudo mover", {
        description: err.message || "Intenta de nuevo.",
      });
    }
  }

  async function togglePromo(id: string, isActive: boolean) {
    const next = !isActive;
    const ok = await confirm({
      title: next ? "Activar promoción" : "Desactivar promoción",
      message: next
        ? "La promoción volverá a mostrarse a los clientes."
        : "La promoción dejará de estar disponible para canje.",
      confirmLabel: next ? "Activar" : "Desactivar",
      tone: next ? "accent" : "warning",
    });
    if (!ok) return;
    await api(`/promotions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: next }),
    });
    await loadPromos();
    await loadOverview();
  }

  async function deletePromo(id: string) {
    const ok = await confirm({
      title: "Eliminar promoción",
      message: "Esta acción no se puede deshacer. ¿Eliminar la promoción?",
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;
    await api(`/promotions/${id}`, { method: "DELETE" });
    await loadPromos();
    await loadOverview();
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? {
              ...s,
              _count: {
                promotions: Math.max(0, (s._count?.promotions ?? 1) - 1),
              },
            }
          : s,
      ),
    );
    await alert({
      title: "Promoción eliminada",
      message: "La recompensa ya no aparece en el listado.",
      tone: "success",
    });
  }

  function exportCsv() {
    const rows = [
      "nombre,telefono,ondas,ventas,roi,visitas_rango,badge,cerca_promo,serial",
    ]
      .concat(
        filteredCustomers.map((c: any) => {
          const near = c.nearPromo
            ? `${c.nearPromo.title} (${c.nearPromo.gap} ondas)`
            : "";
          const roi =
            c.roi != null && Number.isFinite(c.roi)
              ? Number(c.roi).toFixed(2)
              : "";
          return `${c.user.name},${displayPhone(c.user.phone)},${c.points},${c.ventas ?? 0},${roi},${c.visitsInRange},${c.badge || ""},${near},${c.serialNumber}`;
        }),
      )
      .join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-onda-${segment}.csv`;
    a.click();
  }

  function handleInsightAction(id: string, promoId?: string) {
    if (id.startsWith("promo-low-") || id.startsWith("promo-expiring-")) {
      const source =
        (overview?.promoStats || []).find((p: any) => p.id === promoId) ||
        promos.find((p) => p.id === promoId);
      if (source) {
        duplicatePromo(source);
        return;
      }
      router.push("/promos/nueva");
      return;
    }
    if (id === "near-redeem") {
      setSegment("cercaCanje");
      router.push("/clientes");
    } else if (id === "at-risk") {
      setSegment("enRiesgo");
      router.push("/clientes");
    } else if (id === "few-promos" || id === "redeem-drop") {
      router.push("/promos/nueva");
    } else if (id === "wa-limit") {
      router.push("/config");
    }
  }

  const segmentChips: {
    id: CustomerSegment;
    label: string;
    count?: number;
    icon: ReactNode;
  }[] = [
    {
      id: "todos",
      label: "Todos",
      count: customers.length,
      icon: OndaIcons.all,
    },
    {
      id: "nuevos",
      label: "Nuevos",
      count: overview?.segments?.nuevos,
      icon: OndaIcons.sparkle,
    },
    {
      id: "activos",
      label: "Activos",
      count: overview?.segments?.activos,
      icon: OndaIcons.flame,
    },
    {
      id: "cercaCanje",
      label: "Cerca de canje",
      count: overview?.segments?.cercaCanje,
      icon: OndaIcons.target,
    },
    {
      id: "enRiesgo",
      label: "En riesgo",
      count: overview?.segments?.enRiesgo,
      icon: OndaIcons.alert,
    },
    {
      id: "vip",
      label: "VIP",
      count: overview?.segments?.vip,
      icon: OndaIcons.crown,
    },
    {
      id: "dormidos",
      label: "Dormidos",
      count: overview?.segments?.dormidos,
      icon: OndaIcons.moon,
    },
  ];

  return (
    <div className="onda-merchant-caja-layout">
      <AppShell
        title={viewTitle}
        navClusters={navClusters}
        brand={
          storeName
            ? {
                name: storeName,
                logoUrl: store?.passDesign?.logoUrl || storeLogoUrl || null,
              }
            : undefined
        }
        linkComponent={Link}
        onLogout={firebaseEnabled ? () => void logout() : undefined}
        toolbar={
          <div className="onda-toolbar">
            {store?.slug ? (
              <button
                type="button"
                onClick={shareStoreUrl}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
              >
                {OndaIcons.share}
                Compartir
              </button>
            ) : null}
            <CajaOpenButton storeId={storeId} />
            {REGISTER_STORE_ENABLED ? (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
              >
                {OndaIcons.plus}
                Registrar comercio
              </Link>
            ) : null}
            {EVENTOS_ENABLED ? (
              <>
                <SegmentedControl
                  aria-label="Modo"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { id: "global", label: "Global", icon: OndaIcons.globe },
                    { id: "event", label: "Evento", icon: OndaIcons.ticket },
                  ]}
                />
                {mode === "event" ? (
                  <OndaSelect
                    aria-label="Evento"
                    value={eventId}
                    onChange={setEventId}
                    placeholder="Evento"
                    compact
                    options={events.map((ev) => ({
                      id: ev.id,
                      label: ev.name,
                    }))}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        }
      >
        {storesReady && stores.length === 0 ? (
          <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
            <h2 className="font-display text-2xl font-semibold">
              Aún no hay comercios
            </h2>
            <p className="text-[var(--onda-muted)]">
              Registra tu negocio para activar el panel, el pase wallet y tus
              primeras recompensas.
            </p>
            <Link href="/onboarding">
              <GradientButton type="button">
                {OndaIcons.plus}
                Registrar mi comercio
              </GradientButton>
            </Link>
          </div>
        ) : null}

        {tab === "completar" && stores.length > 0 ? (
          <SetupChecklist
            status={setup}
            storeId={storeId}
            store={store}
            cartillaId={
              setup.defaultCartillaId ||
              (cartillasData?.cartillas || []).find((c: any) => c.isDefault)
                ?.id ||
              null
            }
            onCartillaSaved={(cartilla) => {
              setStores((prev) =>
                prev.map((s) =>
                  s.id === storeId
                    ? {
                        ...s,
                        passDesign: {
                          logoUrl:
                            cartilla._storeLogoUrl ??
                            cartilla.passDesign?.logoUrl ??
                            s.passDesign?.logoUrl ??
                            null,
                        },
                        cartillas: [
                          {
                            id: cartilla.id,
                            isDefault: true,
                            _count: {
                              items: cartilla.items?.length ?? 0,
                            },
                          },
                        ],
                      }
                    : s,
                ),
              );
              void loadCartillas();
            }}
            onPromoCreated={async () => {
              await loadPromos();
              setStores((prev) =>
                prev.map((s) =>
                  s.id === storeId
                    ? {
                        ...s,
                        _count: {
                          promotions: (s._count?.promotions ?? 0) + 1,
                        },
                      }
                    : s,
                ),
              );
            }}
          />
        ) : null}

        {stores.length > 0 &&
        ((setup.complete &&
          (["resumen", "comparativa", "clientes"].includes(tab) ||
            isPosSummary)) ||
          (tab === "promos" && !selectedPromoId && !selectedCartillaId)) ? (
          <AnalyticsFiltersBar
            value={filters}
            onChange={setFilters}
            showPromoTypes={
              !(
                selectedCustomerPassId ||
                tab === "comparativa" ||
                isPosSummary
              )
            }
            headerActions={
              tab === "resumen" ? (
                <FilterChip
                  selected={showPulse}
                  icon={showPulse ? OndaIcons.eye : OndaIcons.eyeOff}
                  onClick={() => setShowPulse((v) => !v)}
                >
                  Mensaje
                </FilterChip>
              ) : undefined
            }
            extraGroups={
              isPosSummary
                ? [
                    {
                      id: "pos-method",
                      label: "Medio de pago",
                      summary:
                        posPaymentMethods.length === 0
                          ? "Todos"
                          : posPaymentMethods
                              .map(
                                (k) =>
                                  POS_METHOD_OPTIONS.find((o) => o.id === k)
                                    ?.label || k,
                              )
                              .join(", "),
                      summaryActive: posPaymentMethods.length > 0,
                      children: (
                        <div className="flex flex-wrap gap-1.5">
                          {POS_METHOD_OPTIONS.map((opt) => (
                            <FilterChip
                              key={opt.id}
                              selected={posPaymentMethods.includes(opt.id)}
                              onClick={() => togglePosPaymentMethod(opt.id)}
                            >
                              {opt.label}
                            </FilterChip>
                          ))}
                          {posPaymentMethods.length > 0 ? (
                            <FilterChip
                              selected={false}
                              onClick={() => setPosPaymentMethods([])}
                            >
                              Limpiar
                            </FilterChip>
                          ) : null}
                        </div>
                      ),
                    },
                  ]
                : selectedCustomerPassId ||
                    tab === "comparativa" ||
                    tab !== "promos"
                  ? undefined
                  : [
                      {
                        id: "promo-status",
                        label: "Estado",
                        summary:
                          promoStatusFilter === "active"
                            ? "Activas"
                            : promoStatusFilter === "inactive"
                              ? "Inactivas"
                              : "Todas",
                        summaryActive: promoStatusFilter !== "active",
                        children: (
                          <SegmentedControl
                            aria-label="Estado de promoción"
                            value={promoStatusFilter}
                            onChange={setPromoStatusFilter}
                            options={[
                              {
                                id: "active",
                                label: "Activas",
                                icon: OndaIcons.check,
                              },
                              {
                                id: "inactive",
                                label: "Inactivas",
                                icon: OndaIcons.close,
                              },
                              {
                                id: "all",
                                label: "Todas",
                                icon: OndaIcons.all,
                              },
                            ]}
                          />
                        ),
                      },
                    ]
            }
          />
        ) : null}

        {isPosArea && storeId ? (
          <PosWorkspace
            storeId={storeId}
            memberRole={memberRole}
            filters={filters}
            posEnabled={posEnabled}
            paymentMethods={posPaymentMethods}
            ondaValue={store?.ondaValue}
          />
        ) : null}

        {!isPosArea && tab === "resumen" && (
          <div className="space-y-6">
            {!overview ? (
              <SkeletonDashboard kpis={4} />
            ) : (
              <>
            {/* space-y-6 pone el margen inferior en este hijo; al ocultarlo se
                anula para que la separación la dé solo el mb-5 de los filtros */}
            <Collapsible open={showPulse} className={showPulse ? "" : "mb-0"}>
              <div
                className={`rounded-2xl border px-5 py-4 ${
                  pulse.tone === "good"
                    ? "border-[var(--onda-success)]/30 bg-[var(--onda-success)]/10"
                    : pulse.tone === "ok"
                      ? "border-[var(--onda-sky)]/30 bg-[var(--onda-sky-soft)]"
                      : pulse.tone === "warn"
                        ? "border-amber-400/40 bg-amber-50"
                        : pulse.tone === "bad"
                          ? "border-[var(--onda-danger)]/30 bg-[var(--onda-danger)]/8"
                          : "border-[var(--onda-border)] bg-[var(--onda-card)]"
                }`}
              >
                <p className="mt-1 font-display text-xl font-semibold text-[var(--onda-ink)]">
                  {pulse.title}
                </p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--onda-muted)]">
                  {pulse.line}
                </p>
              </div>
            </Collapsible>

            {overview ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 [&>*]:min-w-0">
                <KpiCard
                  label="Ventas"
                  hint={`Lealtad ${formatCop(kpis?.ventasLealtad ?? 0)} · POS ${formatCop(kpis?.ventasPOS ?? 0)}`}
                  value={formatCop(kpis?.ventas ?? 0)}
                  delta={deltaLabel(kpis?.ventasDelta)}
                  positive={(kpis?.ventasDelta ?? 0) >= 0}
                  tone="sky"
                  icon={
                    <CurrencyCircleDollar
                      className="h-5 w-5"
                      weight="duotone"
                      aria-hidden
                    />
                  }
                />
                {(kpis?.ventasPOS ?? 0) > 0 ? (
                  <KpiCard
                    label="Ventas POS"
                    hint={`${kpis?.posTransactionCount ?? 0} transacciones en caja`}
                    value={formatCop(kpis?.ventasPOS ?? 0)}
                    delta={deltaLabel(kpis?.ventasPOSDelta)}
                    positive={(kpis?.ventasPOSDelta ?? 0) >= 0}
                    tone="primary"
                    icon={
                      <Receipt
                        className="h-5 w-5"
                        weight="duotone"
                        aria-hidden
                      />
                    }
                  />
                ) : null}
                <KpiCard
                  label="Beneficio otorgado"
                  hint="Costo estimado de los canjes en el periodo."
                  value={formatCop(kpis?.beneficioOtorgado ?? 0)}
                  delta={deltaLabel(kpis?.beneficioDelta)}
                  positive={(kpis?.beneficioDelta ?? 0) <= 0}
                  tone="amber"
                  icon={
                    <Gift className="h-5 w-5" weight="duotone" aria-hidden />
                  }
                />
                <KpiCard
                  label="ROI"
                  hint="Ventas ÷ beneficio otorgado."
                  value={formatRoi(kpis?.roi)}
                  tone="success"
                  icon={
                    <TrendUp className="h-5 w-5" weight="duotone" aria-hidden />
                  }
                />
              </div>
            ) : null}

            {overview ? (
              <div className="onda-card flex min-h-[22rem] flex-col overflow-hidden p-4">
                <AnalyticsSectionHeader
                  icon={
                    <ChartLineUp
                      className="h-4 w-4"
                      weight="duotone"
                      aria-hidden
                    />
                  }
                  title="Flujo de ingresos vs. costo en canjes"
                  subtitle="Ventas registradas en caja menos el beneficio otorgado por promo."
                  tone="sky"
                  trailing={
                    !emptyMoneyRange ? (
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-sky-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--onda-sky)]" />
                          Ventas {formatCop(kpis?.ventas ?? 0)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-1 font-medium text-[var(--onda-ink)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--onda-primary)]" />
                          Beneficio {formatCop(kpis?.beneficioOtorgado ?? 0)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                            moneyNeto >= 0
                              ? "bg-[var(--onda-success)]/10 text-[var(--onda-success)]"
                              : "bg-[var(--onda-danger)]/10 text-[var(--onda-danger)]"
                          }`}
                        >
                          Neto {formatCop(moneyNeto)}
                        </span>
                      </div>
                    ) : null
                  }
                />
                <div className="relative mt-3 min-h-[16rem] flex-1">
                  {emptyMoneyRange ? (
                    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 px-4 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                        <ChartLineUp
                          className="h-6 w-6"
                          weight="duotone"
                          aria-hidden
                        />
                      </span>
                      <p className="text-sm text-[var(--onda-muted)]">
                        Aún no hay montos registrados en este periodo.
                      </p>
                      <p className="max-w-md text-xs text-[var(--onda-muted)]">
                        Al acumular, pide el valor de la cuenta en caja. Con eso
                        verás ingresos, costo de canjes y el neto aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="absolute inset-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={moneySeries}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="ondaVentasFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#3DB9E8"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="100%"
                                stopColor="#3DB9E8"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="var(--onda-border)"
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(v) => String(v).slice(5)}
                            fontSize={11}
                            tickMargin={6}
                            interval="preserveStartEnd"
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            fontSize={11}
                            width={52}
                            tickFormatter={formatMoneyAxis}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<MoneyChartTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                            iconSize={10}
                          />
                          <Area
                            type="monotone"
                            dataKey="ventas"
                            name="Ventas"
                            stroke="#3DB9E8"
                            strokeWidth={2}
                            fill="url(#ondaVentasFill)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="beneficio"
                            name="Beneficio otorgado"
                            stroke="#052DDE"
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="neto"
                            name="Neto (ventas − beneficio)"
                            stroke="#2BB673"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!emptyRange ? (
              <div
                className={`grid grid-cols-2 gap-3 ${
                  mode === "event" && overview?.eventMeta
                    ? "lg:grid-cols-5"
                    : "md:grid-cols-4"
                } [&>*]:min-w-0`}
              >
                <KpiCard
                  label="Ondas acumuladas"
                  hint="Onda = punto que el cliente gana en cada compra."
                  value={kpis?.ondas ?? 0}
                  delta={deltaLabel(kpis?.ondasDelta)}
                  positive={(kpis?.ondasDelta ?? 0) >= 0}
                  tone="sky"
                  icon={<OndaHandMark variant="current" className="h-5 w-5" />}
                />
                <KpiCard
                  label="Redenciones"
                  value={kpis?.redenciones ?? 0}
                  delta={deltaLabel(kpis?.redencionesDelta)}
                  positive={(kpis?.redencionesDelta ?? 0) >= 0}
                  tone="primary"
                  icon={
                    <Gift className="h-5 w-5" weight="duotone" aria-hidden />
                  }
                />
                <KpiCard
                  label="Clientes nuevos"
                  value={kpis?.clientesNuevos ?? 0}
                  delta={deltaLabel(kpis?.clientesNuevosDelta)}
                  positive={(kpis?.clientesNuevosDelta ?? 0) >= 0}
                  tone="success"
                  icon={
                    <UsersThree
                      className="h-5 w-5"
                      weight="duotone"
                      aria-hidden
                    />
                  }
                />
                <KpiCard
                  label="Tasa redención"
                  hint="Compara cuántas veces canjearon una promo contra cuántas veces sumaron ondas. Puede superar 100% si canjean ondas que ya tenían acumuladas."
                  value={`${kpis?.tasaRedencion ?? 0}%`}
                  delta={
                    kpis?.tasaRedencionDelta != null
                      ? `${kpis.tasaRedencionDelta > 0 ? "+" : ""}${kpis.tasaRedencionDelta} pp`
                      : undefined
                  }
                  positive={(kpis?.tasaRedencionDelta ?? 0) >= 0}
                  tone="amber"
                  icon={
                    <Percent className="h-5 w-5" weight="duotone" aria-hidden />
                  }
                />
                {mode === "event" && overview?.eventMeta ? (
                  <KpiCard
                    label="Meta evento"
                    value={`${overview.eventMeta.progress}%`}
                    delta={
                      overview.eventMeta.rank
                        ? `#${overview.eventMeta.rank} de ${overview.eventMeta.totalStores}`
                        : undefined
                    }
                    positive
                    tone="primary"
                    icon={
                      <Target
                        className="h-5 w-5"
                        weight="duotone"
                        aria-hidden
                      />
                    }
                  />
                ) : null}
              </div>
            ) : null}

            {(overview?.insights || []).filter(
              (i: any) => posEnabled || !String(i.id).startsWith("pos-"),
            ).length > 0 ? (
              <InsightsPanel
                items={(overview.insights as any[])
                  .filter((i) => posEnabled || !String(i.id).startsWith("pos-"))
                  .map((ins) => ({
                    id: ins.id,
                    tone: ins.tone,
                    title: ins.title,
                    message: ins.message,
                    stat: ins.stat,
                    action: ins.action,
                    onAction: () => handleInsightAction(ins.id, ins.promoId),
                  }))}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:[grid-auto-rows:20rem]">
              <div className="onda-card flex h-[20rem] min-h-0 flex-col overflow-hidden p-4 lg:col-span-2 lg:h-full">
                <AnalyticsSectionHeader
                  icon={
                    <ChartBar className="h-4 w-4" weight="duotone" aria-hidden />
                  }
                  title="Ondas y canjes por día"
                  subtitle="Acumulaciones y redenciones en el periodo"
                  tone="sky"
                />
                <div className="relative mt-3 min-h-0 flex-1">
                  <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={overview?.series || []}
                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => String(v).slice(5)}
                          fontSize={11}
                          tickMargin={6}
                          interval="preserveStartEnd"
                        />
                        <YAxis fontSize={11} allowDecimals={false} width={32} />
                        <Tooltip />
                        <Legend
                          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                          iconSize={10}
                        />
                        <Bar
                          dataKey="ondas"
                          name="Ondas"
                          fill="#3DB9E8"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="canjes"
                          name="Canjes"
                          fill="#052DDE"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <ActivityTimeline
                className="h-[20rem] lg:h-full"
                items={(overview?.recent || []).slice(0, 12).map((t: any) => ({
                  id: t.id,
                  type: t.type,
                  points: t.points,
                  paymentAmount: t.paymentAmount,
                  benefitAmount: t.benefitAmount,
                  promotion: t.promotion
                    ? { title: t.promotion.title, type: t.promotion.type }
                    : null,
                  time: new Date(t.createdAt).toLocaleString("es-CO"),
                }))}
              />
            </div>

              </>
            )}
          </div>
        )}

        {tab === "comparativa" ? (
          <CompareStores
            stores={stores.map((s) => ({ id: s.id, name: s.name }))}
            selectedIds={compareStoreIds}
            onSelectedIdsChange={setCompareStoreIds}
            data={compare}
            loading={compareLoading}
            error={compareError}
            onRetry={loadCompare}
            onOpenStore={openCompareStore}
          />
        ) : null}

        {tab === "clientes" && selectedCustomerPassId ? (
          <CustomerDetail
            detail={customerDetail}
            loading={customerDetailLoading}
            onBack={closeCustomerDetail}
          />
        ) : null}

        {tab === "clientes" && !selectedCustomerPassId && (
          <div className="space-y-4">
            {(overview?.insights || []).filter((i: any) =>
              ["near-redeem", "at-risk"].includes(i.id),
            ).length > 0 ? (
              <InsightsPanel
                items={(overview.insights as any[])
                  .filter((i) => ["near-redeem", "at-risk"].includes(i.id))
                  .slice(0, 2)
                  .map((ins) => ({
                    id: ins.id,
                    tone: ins.tone,
                    title: ins.title,
                    message: ins.message,
                    stat: ins.stat,
                    action: ins.action,
                    onAction: () => handleInsightAction(ins.id, ins.promoId),
                  }))}
              />
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {segmentChips.map((c) => (
                <FilterChip
                  key={c.id}
                  selected={segment === c.id}
                  icon={c.icon}
                  onClick={() => setSegment(c.id)}
                >
                  {c.label}
                  {c.count != null ? ` · ${c.count}` : ""}
                </FilterChip>
              ))}
            </div>

            <div className="onda-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--onda-border)] p-4">
                <h3 className="font-display min-w-0 font-semibold">
                  CRM · {filteredCustomers.length} clientes
                </h3>
                <GradientButton type="button" onClick={exportCsv}>
                  {OndaIcons.download}
                  Exportar CSV
                </GradientButton>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3">Ondas</th>
                      <th className="p-3">Ventas</th>
                      <th className="p-3">ROI</th>
                      <th className="p-3">Última visita</th>
                      <th className="p-3">Visitas</th>
                      <th className="p-3">Badge</th>
                      <th className="p-3">Cerca de</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c: any) => (
                      <tr
                        key={c.passId}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer border-t border-[var(--onda-border)] transition hover:bg-[var(--onda-violet-soft)]/40"
                        onClick={() => openCustomerDetail(c.passId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openCustomerDetail(c.passId);
                          }
                        }}
                      >
                        <td className="p-3 font-medium">{c.user.name}</td>
                        <td className="p-3">{displayPhone(c.user.phone)}</td>
                        <td className="p-3">{c.points}</td>
                        <td className="p-3">{formatCop(c.ventas ?? 0)}</td>
                        <td className="p-3">
                          {c.roi != null && Number.isFinite(c.roi)
                            ? `${Number(c.roi).toFixed(1)}x`
                            : "—"}
                        </td>
                        <td className="p-3 text-xs text-[var(--onda-muted)]">
                          {c.lastVisit
                            ? new Date(c.lastVisit).toLocaleDateString("es-CO")
                            : "—"}
                        </td>
                        <td className="p-3">{c.visitsInRange}</td>
                        <td className="p-3">
                          {c.badge ? <BadgePill badge={c.badge} /> : "—"}
                        </td>
                        <td className="p-3 text-xs">
                          {c.nearPromo
                            ? `a ${c.nearPromo.gap} de ${promoTypeLabel(c.nearPromo.type)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {!filteredCustomers.length ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-6 text-center text-[var(--onda-muted)]"
                        >
                          Sin clientes en este segmento / rango.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "promos" && selectedPromoId && selectedPromoId !== "nueva" ? (
          <PromoDetail
            detail={promoDetail}
            loading={promoDetailLoading}
            onBack={closePromoDetail}
            onDuplicate={duplicatePromo}
            onToggle={async (id, isActive) => {
              await togglePromo(id, isActive);
              const q = new URLSearchParams({
                from: filters.from,
                to: filters.to,
              });
              setPromoDetail(await api(`/promotions/${id}/analytics?${q}`));
            }}
            onDelete={async (id) => {
              await deletePromo(id);
              closePromoDetail();
            }}
            onSaved={async () => {
              const q = new URLSearchParams({
                from: filters.from,
                to: filters.to,
              });
              setPromoDetail(
                await api(`/promotions/${selectedPromoId}/analytics?${q}`),
              );
              await loadPromos();
              await loadOverview();
            }}
            onMovePool={async (promo, next) => {
              await movePromoPool(promo, next);
            }}
          />
        ) : null}

        {tab === "promos" && selectedPromoId === "nueva" ? (
          <CreatePromo
            storeId={storeId}
            store={store}
            duplicateFrom={duplicateSource}
            confirm={confirm}
            alert={alert}
            onCreated={handlePromoCreated}
            onClose={closeCreatePromo}
          />
        ) : null}

        {tab === "promos" && selectedCartillaId ? (
          <CartillaEditor
            storeId={storeId}
            store={store}
            cartillaId={selectedCartillaId}
            onClose={() => {
              void loadCartillas();
              router.push("/promos");
            }}
            onPromoCreated={async () => {
              await loadPromos();
              setStores((prev) =>
                prev.map((s) =>
                  s.id === storeId
                    ? {
                        ...s,
                        _count: {
                          promotions: (s._count?.promotions ?? 0) + 1,
                        },
                      }
                    : s,
                ),
              );
            }}
          />
        ) : null}

        {tab === "promos" && !selectedPromoId && !selectedCartillaId && (
          <div className="space-y-5">
            <div className="onda-kpi-grid">
              <KpiCard
                label="Promos activas"
                value={kpis?.promosActivas ?? 0}
              />
              <KpiCard
                label="Cobertura catálogo"
                value={`${kpis?.coberturaCatalogo ?? 0}%`}
              />
              <KpiCard label="Canjes en rango" value={kpis?.redenciones ?? 0} />
            </div>

            <CartillaCalendar
              storeId={storeId}
              embedded
              onOpen={(id) => router.push(`/promos/cartilla/${id}`)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Cartillas
                </h2>
                <p className="text-sm text-[var(--onda-muted)]">
                  La cartilla base está vigente salvo que una ocasional cubra
                  hoy. Solo una a la vez; al cambiar se reinicia el ciclo.
                </p>
              </div>
              <GradientButton
                type="button"
                onClick={() => router.push("/promos/cartilla/nueva")}
              >
                {OndaIcons.plus}
                Nueva cartilla
              </GradientButton>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(cartillasData?.cartillas || []).map((c: any) => (
                <article
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="onda-card cursor-pointer p-5"
                  onClick={() => router.push(`/promos/cartilla/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/promos/cartilla/${c.id}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-semibold">{c.name}</h3>
                    <span className="text-xs text-[var(--onda-muted)]">
                      {c.isDefault
                        ? "Base"
                        : cartillasData?.activeId === c.id
                          ? "Vigente"
                          : c.status}
                      {c.locked ? " · Bloqueada" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--onda-muted)]">
                    {c.isDefault
                      ? "Vigente cuando ninguna ocasional cubre hoy"
                      : formatCartillaRange(c.startsAt, c.endsAt)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        Ondas
                      </dt>
                      <dd className="font-medium">{c.maxStamps ?? 12}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        Promos
                      </dt>
                      <dd className="font-medium">
                        {c.promoCount ?? (c.items || []).length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        Acumulaciones
                      </dt>
                      <dd className="font-medium">
                        {(c.accumulations ?? 0).toLocaleString("es-CO")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        Redenciones
                      </dt>
                      <dd className="font-medium">
                        {(c.redemptions ?? 0).toLocaleString("es-CO")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        Ventas
                      </dt>
                      <dd className="font-medium">
                        {formatCop(c.ventas ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--onda-muted)]">
                        ROI
                      </dt>
                      <dd className="font-medium">
                        {c.roi != null && Number.isFinite(c.roi)
                          ? `${Number(c.roi).toFixed(1)}x`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Promociones
                </h2>
                <p className="text-sm text-[var(--onda-muted)]">
                  Dos bolsas: Adquisición (Onda capta clientes) y Retención.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  aria-label="Bolsa de promoción"
                  value={promoPoolFilter}
                  onChange={setPromoPoolFilter}
                  options={[
                    { id: "ALL", label: "Ambas", icon: OndaIcons.all },
                    ...PROMO_POOL_OPTIONS,
                  ]}
                />
                <div
                  className="inline-flex rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] p-0.5"
                  role="group"
                  aria-label="Vista de promociones"
                >
                  <button
                    type="button"
                    title="Grilla"
                    aria-label="Vista grilla"
                    aria-pressed={promoView === "grid"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                      promoView === "grid"
                        ? "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                        : "text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
                    }`}
                    onClick={() => setPromoView("grid")}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden
                    >
                      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" />
                      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" />
                      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" />
                      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Lista"
                    aria-label="Vista lista"
                    aria-pressed={promoView === "list"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                      promoView === "list"
                        ? "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                        : "text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
                    }`}
                    onClick={() => setPromoView("list")}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden
                    >
                      <rect x="1.5" y="2" width="3" height="3" rx="0.8" />
                      <rect x="6.5" y="2.5" width="8" height="2" rx="1" />
                      <rect x="1.5" y="6.5" width="3" height="3" rx="0.8" />
                      <rect x="6.5" y="7" width="8" height="2" rx="1" />
                      <rect x="1.5" y="11" width="3" height="3" rx="0.8" />
                      <rect x="6.5" y="11.5" width="8" height="2" rx="1" />
                    </svg>
                  </button>
                </div>
                <GradientButton
                  type="button"
                  onClick={() => router.push("/promos/nueva")}
                >
                  {OndaIcons.plus}
                  Nueva promo
                </GradientButton>
              </div>
            </div>
            {promoPoolFilter === "BIENVENIDA" ? (
              <p className="rounded-2xl bg-[var(--onda-violet-soft)] px-4 py-3 text-sm text-[var(--onda-violet)]">
                Estas promociones serán utilizadas con estrategias comerciales y
                publicitarias administradas por Onda.
              </p>
            ) : null}

            <div
              className={
                promoView === "grid"
                  ? "grid justify-start gap-2 grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,10.5rem)] lg:[grid-template-columns:repeat(auto-fill,15.25rem)]"
                  : "flex flex-col gap-1.5"
              }
            >
              {promos.map((p) => (
                <PromoCatalogCard
                  key={p.id}
                  promo={p}
                  view={promoView}
                  stats={promoStatsMap.get(p.id)}
                  highlight={p.id === justCreatedPromoId}
                  showTypeTag={filters.promoTypes.length !== 1}
                  showStatusTag={promoStatusFilter === "all"}
                  showPoolTag={promoPoolFilter === "ALL"}
                  onOpen={() => openPromoDetail(p.id)}
                  onToggle={() => void togglePromo(p.id, p.isActive)}
                  onDelete={() => void deletePromo(p.id)}
                />
              ))}
              {!promos.length ? (
                <p className="col-span-full text-sm text-[var(--onda-muted)]">
                  No hay promociones con estos filtros. Crea una con “+ Nueva
                  promo”.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {EVENTOS_ENABLED && tab === "eventos" && (
          <div className="space-y-3">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="onda-card flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.event?.name}</p>
                  <p className="truncate text-sm text-[var(--onda-muted)]">
                    {m.customPromo || "Sin promo"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--onda-violet-soft)] px-3 py-1 text-xs text-[var(--onda-violet)]">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "referidos" && storeId ? (
          <ReferralsPanel storeId={storeId} />
        ) : null}

        {tab === "campanas" && campaignNew && storeId ? (
          <Suspense fallback={<SkeletonDetail />}>
            <CampaignWizard
              storeId={storeId}
              store={store || {}}
              onClose={() => router.push("/campanas")}
              onLaunched={() => undefined}
            />
          </Suspense>
        ) : null}

        {tab === "campanas" && campaignId && storeId ? (
          <Suspense fallback={<SkeletonDetail />}>
            <CampaignDetail
              campaignId={campaignId}
              onBack={() => router.push("/campanas")}
            />
          </Suspense>
        ) : null}

        {tab === "campanas" && !campaignNew && !campaignId && storeId ? (
          <CampaignsHome storeId={storeId} confirm={confirm} />
        ) : null}

        {!isPosArea && tab === "config" && storeId ? (
          <ConfigWorkspace
            storeId={storeId}
            store={store}
            billing={billing}
            storeLogoUrl={storeLogoUrl}
            setStoreLogoUrl={setStoreLogoUrl}
            storeCurrency={storeCurrency}
            setStoreCurrency={setStoreCurrency}
            storeOndaValue={storeOndaValue}
            setStoreOndaValue={setStoreOndaValue}
            savingStoreLogo={savingStoreLogo}
            savingStoreEconomics={savingStoreEconomics}
            onSaveLogo={(e) => void saveStoreLogo(e)}
            onSaveEconomics={(e) => void saveStoreEconomics(e)}
            onUpgrade={() => void upgrade()}
            onBillingUpdated={async () => {
              setBilling(await api(`/billing/store/${storeId}`));
            }}
          />
        ) : null}
      </AppShell>
      <PendingRequestsPanel
        storeId={storeId}
        ondaValue={store?.ondaValue}
        onStoreActivity={refreshAfterStoreActivity}
      />
      {dialogs}
    </div>
  );
}
