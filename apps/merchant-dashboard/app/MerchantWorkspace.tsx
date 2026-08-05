"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  KpiCard,
  ActivityTimeline,
  PassPreview,
  GradientButton,
  OndaSelect,
  OndaColorPicker,
  ImageUploadField,
  useOndaDialogs,
  AnalyticsFiltersBar,
  InsightsPanel,
  FilterChip,
  SegmentedControl,
  rangeFromPreset,
  promoTypeLabel,
  formatPromoBenefit,
  PROMO_TYPE_OPTIONS,
  api,
  type AnalyticsFiltersValue,
  type PromoTypeKey,
  OndaIcons,
  BadgePill,
  TxActivityRow,
} from "@onda/shared-ui";
import { displayPhone, derivePassPalette } from "@onda/shared-utils";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PromoDetail } from "./PromoDetail";
import { CustomerDetail } from "./CustomerDetail";
import {
  CompareStores,
  type CompareResponse,
} from "./CompareStores";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { PendingRequestsPanel } from "./PendingRequestsPanel";

type Tab =
  | "resumen"
  | "comparativa"
  | "clientes"
  | "actividad"
  | "promos"
  | "eventos"
  | "config";

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

const SECTIONS: Tab[] = [
  "resumen",
  ...(COMPARATIVA_ENABLED ? (["comparativa"] as const) : []),
  "clientes",
  "actividad",
  "promos",
  "eventos",
  "config",
];

const TYPE_COLORS: Record<string, string> = {
  PERCENT_OFF: "#6E5AE6",
  AMOUNT_OFF: "#3DB9E8",
  BUY_GET: "#22C55E",
  PRODUCT: "#F59E0B",
  OTHER: "#94A3B8",
};

const emptyPromoForm = {
  title: "",
  description: "",
  pointsRequired: "5",
  imageUrl: "" as string,
  isActive: true,
  type: "PRODUCT" as PromoTypeKey,
  value: "",
  buyQuantity: "2",
  getQuantity: "1",
  productName: "",
  expiryMode: "" as "" | "TIME" | "QUANTITY",
  endsAt: "",
  maxRedemptions: "",
};

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function Icon({
  children,
  className = "h-3 w-3",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IcoTag = {
  type: (
    <Icon>
      <path d="M2.5 8.5 8.5 2.5h4v4L6.5 12.5z" />
      <circle cx="11" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
  ),
  top: (
    <Icon>
      <path d="M8 2.5 9.6 6.2l4 .3-3.1 2.6.9 3.9L8 11.2l-3.4 1.8.9-3.9L2.4 6.5l4-.3z" />
    </Icon>
  ),
  cold: (
    <Icon>
      <path d="M8 2.5v11M4.5 5.5 8 8l3.5-2.5M4.5 10.5 8 8l3.5 2.5" />
    </Icon>
  ),
  on: (
    <Icon>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5.5v5" />
    </Icon>
  ),
  off: (
    <Icon>
      <circle cx="8" cy="8" r="5" />
      <path d="M6 8h4" />
    </Icon>
  ),
  eye: (
    <Icon>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </Icon>
  ),
  power: (
    <Icon>
      <path d="M8 2.5v5.5M4.8 4.2a5 5 0 1 0 6.4 0" />
    </Icon>
  ),
  trash: (
    <Icon>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8.5h5l.5-8.5" />
    </Icon>
  ),
};

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

const promoBtnBase =
  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition";
const promoBtnNeutral = `${promoBtnBase} border-[var(--onda-border)] bg-white text-[var(--onda-ink)] hover:border-[var(--onda-violet)]/40 hover:bg-[var(--onda-violet-soft)] hover:text-[var(--onda-violet)]`;
const promoBtnDanger = `${promoBtnBase} border-transparent bg-transparent text-[var(--onda-danger)] hover:border-[var(--onda-danger)]/25 hover:bg-[var(--onda-danger)]/10`;

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
      "Casi no hay ondas ni canjes. Revisa QR, PIN y que el equipo sume en cada venta.",
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

function parseRoute(pathname: string): {
  tab: Tab;
  promoId: string | null;
  customerPassId: string | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  const raw = parts[0] || "resumen";
  // /pase quedó dentro de Configuración
  const section = (raw === "pase" ? "config" : raw) as Tab;
  const tab = SECTIONS.includes(section) ? section : "resumen";
  const promoId = tab === "promos" && parts[1] ? parts[1] : null;
  const customerPassId = tab === "clientes" && parts[1] ? parts[1] : null;
  return { tab, promoId, customerPassId };
}

export function MerchantWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const { tab, promoId: selectedPromoId, customerPassId: selectedCustomerPassId } =
    parseRoute(pathname);

  useEffect(() => {
    if (pathname === "/pase" || pathname.startsWith("/pase/")) {
      router.replace("/config");
    }
  }, [pathname, router]);

  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState<"global" | "event">("global");
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [design, setDesign] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [passId, setPassId] = useState("");
  const [promoForm, setPromoForm] = useState(emptyPromoForm);
  const [promoBusy, setPromoBusy] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoView, setPromoView] = useState<"grid" | "list">("grid");
  const [promoStatusFilter, setPromoStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [promoDetail, setPromoDetail] = useState<any>(null);
  const [promoDetailLoading, setPromoDetailLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [segment, setSegment] = useState<CustomerSegment>("todos");
  const [txTypeFilter, setTxTypeFilter] = useState<
    "ALL" | "ACCUMULATE" | "REDEEM"
  >("ALL");
  const [compareStoreIds, setCompareStoreIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [storesReady, setStoresReady] = useState(false);
  const { confirm, alert, dialogs } = useOndaDialogs();

  const initialRange = rangeFromPreset("14d");
  const [filters, setFilters] = useState<AnalyticsFiltersValue>({
    preset: "14d",
    from: initialRange.from,
    to: initialRange.to,
    promoTypes: [],
  });

  const store = stores.find((s) => s.id === storeId);
  const kpis = overview?.kpis;
  const customers = overview?.customers || [];

  const nav = useMemo(() => {
    const items: Array<
      readonly [Tab, string, ReactNode, boolean]
    > = [
      ["resumen", "Resumen", OndaIcons.chart, false],
      ...(COMPARATIVA_ENABLED && stores.length >= 2
        ? ([["comparativa", "Comparativa", OndaIcons.target, false]] as const)
        : []),
      ["clientes", "Clientes", OndaIcons.users, false],
      ["actividad", "Actividad", OndaIcons.activity, false],
      ["promos", "Promociones", OndaIcons.redeem, false],
      ["eventos", "Eventos", OndaIcons.ticket, false],
      ["config", "Configuración", OndaIcons.gear, true],
    ];
    return items.map(([href, label, icon, footer]) => ({
      href: `/${href}`,
      label,
      icon,
      footer,
      active: tab === href,
    }));
  }, [tab, stores.length]);

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

  const loadTxs = useCallback(async () => {
    if (!storeId) return;
    const params = new URLSearchParams({
      storeId,
      from: filters.from,
      to: filters.to,
    });
    if (mode === "event" && eventId) params.set("eventId", eventId);
    if (txTypeFilter !== "ALL") params.set("type", txTypeFilter);
    if (filters.promoTypes.length)
      params.set("promoTypes", filters.promoTypes.join(","));
    setTxs((await api(`/transactions?${params}`)) as any[]);
  }, [
    storeId,
    filters.from,
    filters.to,
    filters.promoTypes,
    mode,
    eventId,
    txTypeFilter,
  ]);

  const loadPromos = useCallback(async () => {
    if (!storeId) return;
    const params = new URLSearchParams({ storeId });
    if (filters.promoTypes.length)
      params.set("type", filters.promoTypes.join(","));
    if (promoStatusFilter === "active") params.set("isActive", "true");
    if (promoStatusFilter === "inactive") params.set("isActive", "false");
    setPromos((await api(`/promotions?${params}`)) as any[]);
  }, [storeId, filters.promoTypes, promoStatusFilter]);

  useEffect(() => {
    api<any[]>("/stores").then((list) => {
      setStores(list);
      if (list[0]) setStoreId(list[0].id);
      setCompareStoreIds(list.map((s) => s.id));
      setStoresReady(true);
    });
    api<any[]>("/events").then((list) => {
      setEvents(list);
      if (list[0]) setEventId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!storesReady) return;
    if (tab === "comparativa" && stores.length < 2) {
      router.replace("/resumen");
    }
  }, [tab, stores.length, storesReady, router]);

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
    loadTxs();
    loadPromos();
    api<any[]>(`/memberships?storeId=${storeId}`).then(setMemberships);
    api(`/pass-designs/store/${storeId}`)
      .then(setDesign)
      .catch(() => setDesign(null));
    api(`/billing/store/${storeId}`).then(setBilling);
  }, [storeId, mode, eventId, loadOverview, loadTxs, loadPromos]);

  useEffect(() => {
    if (!selectedPromoId) {
      setPromoDetail(null);
      return;
    }
    let cancelled = false;
    setPromoDetailLoading(true);
    const q = new URLSearchParams({
      from: filters.from,
      to: filters.to,
    });
    api(`/promotions/${selectedPromoId}/analytics?${q}`)
      .then((data) => {
        if (!cancelled) setPromoDetail(data);
      })
      .catch(() => {
        if (!cancelled) setPromoDetail(null);
      })
      .finally(() => {
        if (!cancelled) setPromoDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPromoId, filters.from, filters.to]);

  useEffect(() => {
    if (!selectedCustomerPassId || !storeId) {
      setCustomerDetail(null);
      return;
    }
    let cancelled = false;
    setCustomerDetailLoading(true);
    const q = new URLSearchParams({
      from: filters.from,
      to: filters.to,
    });
    api(
      `/analytics/store/${storeId}/customers/${selectedCustomerPassId}?${q}`,
    )
      .then((data) => {
        if (!cancelled) setCustomerDetail(data);
      })
      .catch(() => {
        if (!cancelled) setCustomerDetail(null);
      })
      .finally(() => {
        if (!cancelled) setCustomerDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerPassId, storeId, filters.from, filters.to]);

  function openPromoDetail(id: string) {
    setShowPromoForm(false);
    router.push(`/promos/${id}`);
  }

  function closePromoDetail() {
    setPromoDetail(null);
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
      const hint = String(lowPromo.title || "se te acaban promos").toLowerCase();
      line = pickPulse(PULSE_LOW_PROMO_LINES, pulseSeed, 5)(hint);
    }

    return { tone, title, line };
  }, [overview, emptyRange, kpis, filters.preset, pulseSeed]);

  async function accumulate() {
    try {
      await api("/transactions/accumulate", {
        method: "POST",
        body: JSON.stringify({ passId, storeId, pinCode: pin, points: 1 }),
      });
      await alert({
        title: "Onda acumulada",
        message: "Se sumó 1 onda al pase del cliente.",
        tone: "success",
      });
      await Promise.all([loadTxs(), loadOverview()]);
    } catch (e: any) {
      await alert({
        title: "No se pudo acumular",
        message: e.message || "Revisa el PIN y el pase.",
        tone: "danger",
      });
    }
  }

  function dashboardPinStorageKey(storeId: string) {
    return `onda_dashboard_pin_${storeId}`;
  }

  function getOrPromptDashboardPin(storeId: string): string | null {
    const existing = localStorage.getItem(dashboardPinStorageKey(storeId));
    if (existing) return existing;
    const entered = window.prompt("PIN de la tienda para guardar el tope de sellos");
    if (!entered) return null;
    localStorage.setItem(dashboardPinStorageKey(storeId), entered);
    return entered;
  }

  async function saveDesign(e: FormEvent) {
    e.preventDefault();
    const payload = {
      ...design,
      ...derivePassPalette(design.backgroundColor || "#6E5AE6"),
    };
    const saved = await api(`/pass-designs/store/${storeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setDesign(saved);
    if (store?.maxStamps != null) {
      const currentPinCode = getOrPromptDashboardPin(storeId);
      if (!currentPinCode) {
        await alert({
          title: "PIN requerido",
          message: "Necesitas el PIN de la tienda para guardar el tope de sellos.",
          tone: "warning",
        });
        return;
      }
      try {
        const updatedStore = await api(`/stores/${storeId}`, {
          method: "PATCH",
          body: JSON.stringify({ maxStamps: store.maxStamps, currentPinCode }),
        });
        setStores((prev) => prev.map((s) => (s.id === storeId ? updatedStore : s)));
      } catch (err: any) {
        if (err.message === "PIN de tienda inválido") {
          localStorage.removeItem(dashboardPinStorageKey(storeId));
        }
        await alert({
          title: "Diseño guardado, pero el tope de sellos no se actualizó",
          message: err.message || "Intenta de nuevo.",
          tone: "danger",
        });
        return;
      }
    }
    await alert({
      title: "Diseño guardado",
      message: "La vista previa del pase quedó actualizada.",
      tone: "success",
    });
  }

  async function upgrade() {
    const ok = await confirm({
      title: "Upgrade a PRO",
      message:
        "Se actualizará el plan de esta sede a PRO (sandbox Wompi). ¿Continuar?",
      confirmLabel: "Subir a PRO",
      tone: "accent",
    });
    if (!ok) return;
    await api(`/billing/store/${storeId}/upgrade`, { method: "POST" });
    setBilling(await api(`/billing/store/${storeId}`));
    await alert({
      title: "Plan actualizado",
      message: "La sede ahora está en plan PRO.",
      tone: "success",
    });
  }

  async function createPromo(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !promoForm.title.trim()) return;
    if (!promoForm.expiryMode) {
      await alert({
        title: "Caducidad requerida",
        message:
          "Indica si la promo caduca por tiempo o por cantidad de redenciones.",
        tone: "warning",
      });
      return;
    }
    if (promoForm.expiryMode === "TIME" && !promoForm.endsAt) {
      await alert({
        title: "Fecha requerida",
        message: "Indica hasta cuándo estará disponible.",
        tone: "warning",
      });
      return;
    }
    if (
      promoForm.expiryMode === "QUANTITY" &&
      (!promoForm.maxRedemptions || Number(promoForm.maxRedemptions) < 1)
    ) {
      await alert({
        title: "Cantidad requerida",
        message: "Indica el máximo de redenciones.",
        tone: "warning",
      });
      return;
    }
    setPromoBusy(true);
    try {
      const body: Record<string, unknown> = {
        storeId,
        title: promoForm.title.trim(),
        description: promoForm.description.trim() || undefined,
        pointsRequired: Number(promoForm.pointsRequired) || 1,
        imageUrl: promoForm.imageUrl || undefined,
        isActive: promoForm.isActive,
        type: promoForm.type,
        expiryMode: promoForm.expiryMode,
      };
      if (promoForm.expiryMode === "TIME") body.endsAt = promoForm.endsAt;
      if (promoForm.expiryMode === "QUANTITY") {
        body.maxRedemptions = Number(promoForm.maxRedemptions);
      }
      if (promoForm.type === "PERCENT_OFF" || promoForm.type === "AMOUNT_OFF") {
        body.value = Number(promoForm.value) || 0;
      }
      if (promoForm.type === "BUY_GET") {
        body.buyQuantity = Number(promoForm.buyQuantity) || 1;
        body.getQuantity = Number(promoForm.getQuantity) || 1;
      }
      if (promoForm.type === "PRODUCT") {
        body.productName =
          promoForm.productName.trim() || promoForm.title.trim();
        if (promoForm.value) body.value = Number(promoForm.value);
      }
      await api("/promotions", { method: "POST", body: JSON.stringify(body) });
      await loadPromos();
      await loadOverview();
      setPromoForm(emptyPromoForm);
      setShowPromoForm(false);
      await alert({
        title: "Promoción creada",
        message: "La recompensa ya está disponible para tus clientes.",
        tone: "success",
      });
    } catch (err: any) {
      await alert({
        title: "Error al crear promo",
        message: err.message || "Intenta de nuevo.",
        tone: "danger",
      });
    } finally {
      setPromoBusy(false);
    }
  }

  function duplicatePromo(source: any) {
    setPromoDetail(null);
    setPromoForm({
      title: source.title || "",
      description: source.description || "",
      pointsRequired: String(source.pointsRequired ?? 5),
      imageUrl: source.imageUrl || "",
      isActive: true,
      type: (source.type as PromoTypeKey) || "PRODUCT",
      value: source.value != null ? String(source.value) : "",
      buyQuantity:
        source.buyQuantity != null ? String(source.buyQuantity) : "2",
      getQuantity:
        source.getQuantity != null ? String(source.getQuantity) : "1",
      productName: source.productName || "",
      expiryMode: "",
      endsAt: "",
      maxRedemptions: "",
    });
    setShowPromoForm(true);
    router.push("/promos");
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
    await alert({
      title: "Promoción eliminada",
      message: "La recompensa ya no aparece en el listado.",
      tone: "success",
    });
  }

  function exportCsv() {
    const rows = [
      "nombre,telefono,ondas,visitas_rango,badge,cerca_promo,serial",
    ]
      .concat(
        filteredCustomers.map((c: any) => {
          const near = c.nearPromo
            ? `${c.nearPromo.title} (${c.nearPromo.gap} ondas)`
            : "";
          return `${c.user.name},${displayPhone(c.user.phone)},${c.points},${c.visitsInRange},${c.badge || ""},${near},${c.serialNumber}`;
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
      setShowPromoForm(true);
      router.push("/promos");
      return;
    }
    if (id === "near-redeem") {
      setSegment("cercaCanje");
      router.push("/clientes");
    } else if (id === "at-risk") {
      setSegment("enRiesgo");
      router.push("/clientes");
    } else if (id === "few-promos" || id === "redeem-drop") {
      setShowPromoForm(true);
      router.push("/promos");
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
    { id: "todos", label: "Todos", count: customers.length, icon: OndaIcons.all },
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
    { id: "vip", label: "VIP", count: overview?.segments?.vip, icon: OndaIcons.crown },
    {
      id: "dormidos",
      label: "Dormidos",
      count: overview?.segments?.dormidos,
      icon: OndaIcons.moon,
    },
  ];

  const promoPreview = formatPromoBenefit({
    ...promoForm,
    value: promoForm.value ? Number(promoForm.value) : null,
    buyQuantity: Number(promoForm.buyQuantity) || null,
    getQuantity: Number(promoForm.getQuantity) || null,
    pointsRequired: Number(promoForm.pointsRequired) || 0,
  });

  return (
    <>
      <AppShell
        title={store?.name || "Merchant"}
        nav={nav}
        userName={store?.name || "M"}
        linkComponent={Link}
        toolbar={
          <div className="onda-toolbar">
            <OndaSelect
              aria-label="Sede"
              value={storeId}
              onChange={setStoreId}
              placeholder="Sede"
              compact
              options={stores.map((s) => ({ id: s.id, label: s.name }))}
            />
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
                options={events.map((ev) => ({ id: ev.id, label: ev.name }))}
              />
            ) : null}
          </div>
        }
      >
        {["resumen", "comparativa", "clientes", "actividad"].includes(tab) ||
        (tab === "promos" && !selectedPromoId) ? (
          <AnalyticsFiltersBar
            value={filters}
            onChange={setFilters}
            showPromoTypes={
              selectedCustomerPassId || tab === "comparativa"
                ? false
                : tab !== "actividad" || txTypeFilter !== "ACCUMULATE"
            }
            extraGroups={
              selectedCustomerPassId || tab === "comparativa"
                ? undefined
                : tab === "actividad"
                  ? [
                      {
                        id: "tx-type",
                        label: "Movimiento",
                        children: (
                          <SegmentedControl
                            aria-label="Tipo de movimiento"
                            value={txTypeFilter}
                            onChange={setTxTypeFilter}
                            options={[
                              { id: "ALL", label: "Todos", icon: OndaIcons.all },
                              {
                                id: "ACCUMULATE",
                                label: "Acumular",
                                icon: OndaIcons.accumulate,
                              },
                              {
                                id: "REDEEM",
                                label: "Canjear",
                                icon: OndaIcons.redeem,
                              },
                            ]}
                          />
                        ),
                      },
                    ]
                  : tab === "promos"
                    ? [
                        {
                          id: "promo-status",
                          label: "Estado",
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
                              { id: "all", label: "Todas", icon: OndaIcons.all },
                            ]}
                          />
                          ),
                        },
                      ]
                    : undefined
            }
          />
        ) : null}

        {tab === "resumen" && (
          <div className="space-y-6">
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
                        : "border-[var(--onda-border)] bg-white"
              }`}
            >
              <p className="mt-1 font-display text-xl font-semibold text-[var(--onda-ink)]">
                {pulse.title}
              </p>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--onda-muted)]">
                {pulse.line}
              </p>
            </div>

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
                />
                <KpiCard
                  label="Redenciones"
                  value={kpis?.redenciones ?? 0}
                  delta={deltaLabel(kpis?.redencionesDelta)}
                  positive={(kpis?.redencionesDelta ?? 0) >= 0}
                />
                <KpiCard
                  label="Clientes nuevos"
                  value={kpis?.clientesNuevos ?? 0}
                  delta={deltaLabel(kpis?.clientesNuevosDelta)}
                  positive={(kpis?.clientesNuevosDelta ?? 0) >= 0}
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
                  />
                ) : null}
              </div>
            ) : null}

            {(overview?.insights || []).length > 0 ? (
              <InsightsPanel
                items={(overview.insights as any[]).map((ins) => ({
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
                <h3 className="font-display shrink-0 text-sm font-semibold">
                  Ondas y canjes por día
                </h3>
                <div className="relative mt-2 min-h-0 flex-1">
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
                        <YAxis
                          fontSize={11}
                          allowDecimals={false}
                          width={32}
                        />
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
                          fill="#6E5AE6"
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
                  promotion: t.promotion
                    ? { title: t.promotion.title, type: t.promotion.type }
                    : null,
                  time: new Date(t.createdAt).toLocaleString("es-CO"),
                }))}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="onda-card p-5">
                <h3 className="font-display font-semibold">
                  Canjes por tipo de promo
                </h3>
                <div className="mt-4 h-56">
                  {(overview?.redemptionsByType || []).length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.redemptionsByType}
                          dataKey="count"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(e: any) => promoTypeLabel(e.type)}
                        >
                          {overview.redemptionsByType.map((row: any) => (
                            <Cell
                              key={row.type}
                              fill={TYPE_COLORS[row.type] || "#94A3B8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, _n: any, p: any) => [
                            v,
                            promoTypeLabel(p?.payload?.type),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-[var(--onda-muted)]">
                      Sin canjes tipados en el rango.
                    </p>
                  )}
                </div>
              </div>
              <ActivityHeatmap data={overview?.heatmap} />
            </div>
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
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3">Ondas</th>
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
                          colSpan={7}
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

        {tab === "actividad" && (
          <div className="space-y-5">
            <div className="onda-kpi-grid">
              <KpiCard
                label="Ondas acumuladas en la última hora"
                value={overview?.ops?.ondasLastHour ?? 0}
              />
              <KpiCard
                label="Acumulaciones / Canjes"
                value={`${overview?.ops?.accumulateInRange ?? 0} / ${overview?.ops?.redeemInRange ?? 0}`}
              />
              <KpiCard
                label="Desde última transacción"
                value={
                  overview?.ops?.minutesSinceLastTx == null
                    ? "—"
                    : overview.ops.minutesSinceLastTx >= 60
                      ? `${Math.round(overview.ops.minutesSinceLastTx / 60)} h`
                      : `${overview.ops.minutesSinceLastTx} min`
                }
                delta={
                  overview?.ops?.minutesSinceLastTx != null &&
                  overview.ops.minutesSinceLastTx > 90
                    ? "Caja fría"
                    : undefined
                }
                positive={
                  !(
                    overview?.ops?.minutesSinceLastTx != null &&
                    overview.ops.minutesSinceLastTx > 90
                  )
                }
              />
            </div>

            {overview?.ops?.minutesSinceLastTx != null &&
            overview.ops.minutesSinceLastTx > 90 ? (
              <InsightsPanel
                items={[
                  {
                    tone: "warning",
                    title: "Caja fría",
                    message:
                      "Lleva más de 90 minutos sin movimientos. Revisa QR/NFC o el PIN de caja.",
                    stat: `${overview.ops.minutesSinceLastTx}m`,
                    action: "Ir a acumular",
                  },
                ]}
              />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-1">
              <div className="onda-card p-5">
                <h3 className="font-display font-semibold">
                  Historial de movimientos
                </h3>
                <ul className="onda-tx-list mt-3 max-h-80 overflow-auto">
                  {txs.map((t: any) => (
                    <TxActivityRow
                      key={t.id}
                      item={{
                        id: t.id,
                        type: t.type,
                        points: t.points,
                        person: t.pass?.user?.name,
                        promotion: t.promotion
                          ? {
                              title: t.promotion.title,
                              type: t.promotion.type,
                            }
                          : null,
                        time: new Date(t.createdAt).toLocaleString("es-CO"),
                      }}
                    />
                  ))}
                  {!txs.length ? (
                    <li className="py-4 text-center text-sm text-[var(--onda-muted)]">
                      Sin movimientos con estos filtros.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "promos" && selectedPromoId ? (
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
          />
        ) : null}

        {tab === "promos" && !selectedPromoId && (
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Promociones
                </h2>
                <p className="text-sm text-[var(--onda-muted)]">
                  Tipología de beneficio + performance del rango filtrado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-full border border-[var(--onda-border)] bg-white p-0.5"
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
                  onClick={() => setShowPromoForm((v) => !v)}
                >
                  {showPromoForm ? OndaIcons.close : OndaIcons.plus}
                  {showPromoForm ? "Cerrar" : "Nueva promo"}
                </GradientButton>
              </div>
            </div>

            {showPromoForm && (
              <form
                onSubmit={createPromo}
                className="onda-card grid gap-5 p-5 lg:grid-cols-[220px_1fr]"
              >
                <div>
                  <ImageUploadField
                    label="Imagen de la promo"
                    value={promoForm.imageUrl}
                    onChange={(imageUrl) =>
                      setPromoForm((f) => ({ ...f, imageUrl }))
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PROMO_TYPE_OPTIONS.map((t) => (
                      <FilterChip
                        key={t.id}
                        selected={promoForm.type === t.id}
                        icon={t.icon}
                        onClick={() =>
                          setPromoForm((f) => ({ ...f, type: t.id }))
                        }
                      >
                        {t.label}
                      </FilterChip>
                    ))}
                  </div>
                  <input
                    required
                    placeholder="Título (ej. Postre gratis)"
                    className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
                    value={promoForm.title}
                    onChange={(e) =>
                      setPromoForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                  <textarea
                    placeholder="Descripción opcional"
                    rows={2}
                    className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
                    value={promoForm.description}
                    onChange={(e) =>
                      setPromoForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  />

                  {promoForm.type === "PERCENT_OFF" ? (
                    <label className="block text-sm text-[var(--onda-muted)]">
                      Porcentaje (1–100)
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={promoForm.value}
                        onChange={(e) =>
                          setPromoForm((f) => ({ ...f, value: e.target.value }))
                        }
                      />
                    </label>
                  ) : null}
                  {promoForm.type === "AMOUNT_OFF" ? (
                    <label className="block text-sm text-[var(--onda-muted)]">
                      Monto off (COP)
                      <input
                        type="number"
                        min={1}
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={promoForm.value}
                        onChange={(e) =>
                          setPromoForm((f) => ({ ...f, value: e.target.value }))
                        }
                      />
                    </label>
                  ) : null}
                  {promoForm.type === "BUY_GET" ? (
                    <div className="flex flex-wrap gap-3">
                      <label className="text-sm text-[var(--onda-muted)]">
                        Compra N
                        <input
                          type="number"
                          min={1}
                          required
                          className="ml-2 w-20 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.buyQuantity}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              buyQuantity: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="text-sm text-[var(--onda-muted)]">
                        Lleva M
                        <input
                          type="number"
                          min={1}
                          required
                          className="ml-2 w-20 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.getQuantity}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              getQuantity: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  {promoForm.type === "PRODUCT" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm text-[var(--onda-muted)]">
                        Nombre del producto
                        <input
                          className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.productName}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              productName: e.target.value,
                            }))
                          }
                          placeholder="Ej. Postre del día"
                        />
                      </label>
                      <label className="text-sm text-[var(--onda-muted)]">
                        Precio especial (opcional)
                        <input
                          type="number"
                          min={0}
                          className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.value}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              value: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  <p className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-xs text-[var(--onda-muted)]">
                    Preview: {promoPreview}
                  </p>

                  <div className="rounded-xl border border-[var(--onda-border)] p-3 space-y-3">
                    <p className="text-sm font-medium text-[var(--onda-ink)]">
                      ¿Cómo caduca?{" "}
                      <span className="text-[var(--onda-danger)]">*</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <FilterChip
                        selected={promoForm.expiryMode === "TIME"}
                        icon={OndaIcons.calendar}
                        onClick={() =>
                          setPromoForm((f) => ({
                            ...f,
                            expiryMode: "TIME",
                            maxRedemptions: "",
                          }))
                        }
                      >
                        Por tiempo
                      </FilterChip>
                      <FilterChip
                        selected={promoForm.expiryMode === "QUANTITY"}
                        icon={OndaIcons.nXm}
                        onClick={() =>
                          setPromoForm((f) => ({
                            ...f,
                            expiryMode: "QUANTITY",
                            endsAt: "",
                          }))
                        }
                      >
                        Por cantidad
                      </FilterChip>
                    </div>
                    {promoForm.expiryMode === "TIME" ? (
                      <label className="block text-sm text-[var(--onda-muted)]">
                        Disponible hasta
                        <input
                          type="date"
                          required
                          className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.endsAt}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              endsAt: e.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                    {promoForm.expiryMode === "QUANTITY" ? (
                      <label className="block text-sm text-[var(--onda-muted)]">
                        Máximo de redenciones
                        <input
                          type="number"
                          min={1}
                          required
                          className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                          value={promoForm.maxRedemptions}
                          onChange={(e) =>
                            setPromoForm((f) => ({
                              ...f,
                              maxRedemptions: e.target.value,
                            }))
                          }
                          placeholder="Ej. 50"
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="text-sm text-[var(--onda-muted)]">
                      Ondas requeridas
                      <input
                        type="number"
                        min={1}
                        max={store?.maxStamps ?? 12}
                        required
                        className="ml-2 w-24 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={promoForm.pointsRequired}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            pointsRequired: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <span className="text-xs text-[var(--onda-muted)]">
                      de {store?.maxStamps ?? 12} sellos del ciclo
                    </span>
                    <label className="flex items-center gap-2 text-sm text-[var(--onda-muted)]">
                      <input
                        type="checkbox"
                        checked={promoForm.isActive}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            isActive: e.target.checked,
                          }))
                        }
                        className="accent-[var(--onda-violet)]"
                      />
                      Activa al crear
                    </label>
                  </div>
                  <GradientButton type="submit" disabled={promoBusy}>
                    {OndaIcons.plus}
                    {promoBusy ? "Guardando…" : "Crear promoción"}
                  </GradientButton>
                </div>
              </form>
            )}

            <div
              className={
                promoView === "grid"
                  ? "grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "flex flex-col gap-2"
              }
            >
              {promos.map((p) => {
                const stats = promoStatsMap.get(p.id);
                const canjes = stats?.canjesInRange ?? 0;
                const badge =
                  canjes >= 3 ? "Top" : canjes === 0 ? "Sin tracción" : null;
                const benefit = formatPromoBenefit(p);

                return promoView === "grid" ? (
                  <article
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPromoDetail(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPromoDetail(p.id);
                      }
                    }}
                    className="onda-card cursor-pointer overflow-hidden transition hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/10] bg-[var(--onda-bg)]">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center onda-gradient text-xl font-bold text-white/90">
                          Onda
                        </div>
                      )}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        <PromoTag
                          icon={IcoTag.type}
                          className="bg-white/90 text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={badge === "Top" ? IcoTag.top : IcoTag.cold}
                            className={
                              badge === "Top"
                                ? "bg-[var(--onda-success)] text-white"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {badge}
                          </PromoTag>
                        ) : null}
                      </div>
                      <PromoTag
                        icon={p.isActive ? IcoTag.on : IcoTag.off}
                        className={`absolute right-2 top-2 ${
                          p.isActive
                            ? "bg-[var(--onda-success)] text-white"
                            : "bg-white/90 text-[var(--onda-muted)]"
                        }`}
                      >
                        {p.isActive ? "Activa" : "Inactiva"}
                      </PromoTag>
                    </div>
                    <div className="space-y-1.5 p-3">
                      <h3 className="font-display text-sm font-semibold leading-snug line-clamp-2">
                        {p.title}
                      </h3>
                      <p className="line-clamp-2 text-xs text-[var(--onda-muted)]">
                        {benefit}
                      </p>
                      <p className="text-xs text-[var(--onda-muted)]">
                        {canjes} canjes · {stats?.elegibles ?? 0} elegibles
                        {stats?.remaining != null
                          ? ` · ${stats.remaining} rest.`
                          : stats?.daysLeft != null
                            ? ` · ${stats.daysLeft}d`
                            : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          className={promoBtnNeutral}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPromoDetail(p.id);
                          }}
                        >
                          {IcoTag.eye}
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          className={promoBtnNeutral}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePromo(p.id, p.isActive);
                          }}
                        >
                          {IcoTag.power}
                          {p.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className={promoBtnDanger}
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePromo(p.id);
                          }}
                        >
                          {IcoTag.trash}
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ) : (
                  <article
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPromoDetail(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPromoDetail(p.id);
                      }
                    }}
                    className="onda-card flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition hover:shadow-md"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--onda-bg)]">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center onda-gradient text-xs font-bold text-white">
                          O
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-display text-sm font-semibold">
                          {p.title}
                        </h3>
                        <PromoTag
                          icon={IcoTag.type}
                          className="bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={badge === "Top" ? IcoTag.top : IcoTag.cold}
                            className={
                              badge === "Top"
                                ? "bg-[var(--onda-success)] text-white"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {badge}
                          </PromoTag>
                        ) : null}
                        <PromoTag
                          icon={p.isActive ? IcoTag.on : IcoTag.off}
                          className={
                            p.isActive
                              ? "bg-[var(--onda-success)]/15 text-[var(--onda-success)]"
                              : "bg-[var(--onda-bg)] text-[var(--onda-muted)]"
                          }
                        >
                          {p.isActive ? "Activa" : "Inactiva"}
                        </PromoTag>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--onda-muted)]">
                        {benefit} · {canjes} canjes · {stats?.elegibles ?? 0}{" "}
                        elegibles
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        type="button"
                        className={promoBtnNeutral}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPromoDetail(p.id);
                        }}
                      >
                        {IcoTag.eye}
                        Detalle
                      </button>
                      <button
                        type="button"
                        className={promoBtnNeutral}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePromo(p.id, p.isActive);
                        }}
                      >
                        {IcoTag.power}
                        {p.isActive ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        className={promoBtnDanger}
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePromo(p.id);
                        }}
                      >
                        {IcoTag.trash}
                        Eliminar
                      </button>
                    </div>
                  </article>
                );
              })}
              {!promos.length ? (
                <p className="text-[var(--onda-muted)] xl:col-span-5">
                  No hay promociones con estos filtros. Crea una con “+ Nueva
                  promo”.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {tab === "eventos" && (
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

        {tab === "config" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="onda-card space-y-2 p-5">
                <h3 className="font-display font-semibold">Sede</h3>
                <p>Place ID: {store?.googlePlaceId || "—"}</p>
                <p>Plan: {billing?.planType}</p>
                <p>
                  WhatsApp atribuido: {billing?.whatsappUsed}/
                  {billing?.whatsappLimit} (excedente {billing?.overageCop} COP)
                </p>
                {billing?.planType === "BASIC" ? (
                  <GradientButton type="button" onClick={upgrade}>
                    {OndaIcons.upgrade}
                    Upgrade a PRO (Wompi sandbox)
                  </GradientButton>
                ) : null}
              </div>
              <div className="onda-card p-5">
                <h3 className="font-display font-semibold">Features PRO</h3>
                <ul className="mt-3 space-y-1 text-sm text-[var(--onda-muted)]">
                  <li>
                    Review gating:{" "}
                    {billing?.features?.reviewGating ? "Sí" : "No"}
                  </li>
                  <li>NPS: {billing?.features?.npsSurveys ? "Sí" : "No"}</li>
                  <li>GPS: {billing?.features?.gpsProximity ? "Sí" : "No"}</li>
                </ul>
              </div>
            </div>

            {design ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[var(--onda-violet)]" aria-hidden>
                    {OndaIcons.pass}
                  </span>
                  <h3 className="font-display text-lg font-semibold">
                    Diseño del pase
                  </h3>
                </div>
                <div className="onda-pass-designer-layout">
                  <form
                    onSubmit={saveDesign}
                    className="onda-card onda-pass-designer p-6"
                  >
                    <div className="onda-pass-designer-brand">
                      <ImageUploadField
                        label="Logo"
                        hint="JPG, PNG o WEBP"
                        aspectClass="aspect-square"
                        className="onda-pass-designer-logo"
                        value={design.logoUrl || ""}
                        onChange={(logoUrl) =>
                          setDesign({ ...design, logoUrl })
                        }
                      />
                      <div className="onda-pass-designer-brand-color">
                        <OndaColorPicker
                          label="Color de marca"
                          value={design.backgroundColor || "#6E5AE6"}
                          fallback="#6E5AE6"
                          onChange={(backgroundColor) =>
                            setDesign({
                              ...design,
                              ...derivePassPalette(backgroundColor),
                            })
                          }
                        />
                        <p className="mt-2 text-xs leading-snug text-[var(--onda-muted)]">
                          El texto y las etiquetas se ajustan solos para contraste
                          y jerarquía.
                        </p>
                      </div>
                    </div>

                    <div className="onda-pass-designer-fields">
                      <div className="onda-pass-designer-row">
                        <label>
                          <span>Título</span>
                          <input
                            value={design.title || ""}
                            onChange={(e) =>
                              setDesign({ ...design, title: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span>Subtítulo</span>
                          <input
                            value={design.subtitle || ""}
                            onChange={(e) =>
                              setDesign({
                                ...design,
                                subtitle: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <label>
                        <span>Descripción</span>
                        <textarea
                          rows={3}
                          value={design.description || ""}
                          onChange={(e) =>
                            setDesign({
                              ...design,
                              description: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        <span>Número de sellos del ciclo</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          required
                          value={store?.maxStamps ?? 12}
                          onChange={(e) => {
                            const maxStamps = Number(e.target.value);
                            setStores((prev) =>
                              prev.map((s) => (s.id === storeId ? { ...s, maxStamps } : s))
                            );
                          }}
                        />
                      </label>

                      <div className="flex justify-end pt-1">
                        <GradientButton type="submit">
                          {OndaIcons.save}
                          Guardar preview
                        </GradientButton>
                      </div>
                    </div>
                  </form>

                  <div className="onda-pass-designer-preview">
                    <p className="onda-pass-designer-label mb-3">Vista previa</p>
                    <PassPreview
                      {...design}
                      points={Math.min(3, store?.maxStamps ?? 12)}
                      maxStamps={store?.maxStamps ?? 12}
                      milestoneStamps={promos
                        .filter((p: any) => p.isActive)
                        .map((p: any) => p.pointsRequired)}
                      memberName="Cliente demo"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="onda-card p-5 text-sm text-[var(--onda-muted)]">
                Cargando diseño del pase…
              </div>
            )}
          </div>
        )}
      </AppShell>
      <PendingRequestsPanel storeId={storeId} />
      {dialogs}
    </>
  );
}
