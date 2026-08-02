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
  InsightCard,
  FilterChip,
  SegmentedControl,
  rangeFromPreset,
  promoTypeLabel,
  formatPromoBenefit,
  PROMO_TYPE_OPTIONS,
  api,
  type AnalyticsFiltersValue,
  type PromoTypeKey,
} from "@onda/shared-ui";
import { displayPhone, derivePassPalette } from "@onda/shared-utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PromoDetail } from "./PromoDetail";

type Tab =
  | "resumen"
  | "clientes"
  | "actividad"
  | "promos"
  | "eventos"
  | "pase"
  | "config";

type CustomerSegment =
  | "todos"
  | "nuevos"
  | "activos"
  | "cercaCanje"
  | "enRiesgo"
  | "vip"
  | "dormidos";

const SECTIONS: Tab[] = [
  "resumen",
  "clientes",
  "actividad",
  "promos",
  "eventos",
  "pase",
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

function parseRoute(pathname: string): { tab: Tab; promoId: string | null } {
  const parts = pathname.split("/").filter(Boolean);
  const section = (parts[0] || "resumen") as Tab;
  const tab = SECTIONS.includes(section) ? section : "resumen";
  const promoId = tab === "promos" && parts[1] ? parts[1] : null;
  return { tab, promoId };
}

export function MerchantWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const { tab, promoId: selectedPromoId } = parseRoute(pathname);

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
  const [segment, setSegment] = useState<CustomerSegment>("todos");
  const [txTypeFilter, setTxTypeFilter] = useState<
    "ALL" | "ACCUMULATE" | "REDEEM"
  >("ALL");
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

  const nav = useMemo(
    () =>
      (
        [
          ["resumen", "Resumen"],
          ["clientes", "Clientes"],
          ["actividad", "Actividad"],
          ["promos", "Promociones"],
          ["eventos", "Eventos"],
          ["pase", "Diseño del pase"],
          ["config", "Configuración"],
        ] as const
      ).map(([href, label]) => ({
        href: `/${href}`,
        label,
        active: tab === href,
      })),
    [tab],
  );

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
    });
    api<any[]>("/events").then((list) => {
      setEvents(list);
      if (list[0]) setEventId(list[0].id);
    });
  }, []);

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

  function openPromoDetail(id: string) {
    setShowPromoForm(false);
    router.push(`/promos/${id}`);
  }

  function closePromoDetail() {
    setPromoDetail(null);
    router.push("/promos");
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

  const showHourly =
    filters.preset === "today" ||
    filters.preset === "7d" ||
    (new Date(filters.to).getTime() - new Date(filters.from).getTime()) /
      86400000 <=
      7;

  const emptyRange =
    overview &&
    (overview.kpis?.ondas ?? 0) === 0 &&
    (overview.kpis?.redenciones ?? 0) === 0 &&
    (overview.series || []).every((r: any) => !r.ondas && !r.canjes);

  const pulse = useMemo(() => {
    if (!overview) {
      return {
        tone: "neutral" as const,
        title: "Cargando el panorama…",
        line: "Un momento mientras armamos el resumen.",
      };
    }
    if (emptyRange) {
      return {
        tone: "neutral" as const,
        title: "Por acá no hay movimiento",
        line: "Con estos filtros no aparece casi nada. Prueba ampliar las fechas o quitar filtros de promo.",
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

    if (score >= 3) {
      return {
        tone: "good" as const,
        title: `Va viento en popa ${periodHint}`,
        line:
          redeemD >= ondasD
            ? "La gente está acumulando y canjeando. Sigue así, el programa se siente vivo."
            : "Hay buen flujo de ondas. Si quieres más canjes, empuja una promo de 3–5 ondas.",
      };
    }
    if (score >= 0) {
      return {
        tone: "ok" as const,
        title: `Va tirando ${periodHint}`,
        line: lowPromo
          ? `No está mal, pero ojo: ${lowPromo.title.toLowerCase()}. Conviene duplicar o crear otra.`
          : redeemD < 0
            ? "Hay movimiento, pero los canjes van un poco flojos frente al periodo anterior."
            : "Números estables. Nada alarmante, tampoco un festín.",
      };
    }
    if (score >= -3) {
      return {
        tone: "warn" as const,
        title: `Anda flojo ${periodHint}`,
        line:
          ondasD < 0 && redeemD < 0
            ? "Bajaron ondas y canjes. Revisa el QR/caja o lanza un gancho fácil de canjear."
            : redeemD <= -25
              ? "Acumulan, pero casi no canjean. El catálogo puede no estar motivando."
              : "Hay señales de enfriamiento. Un empujoncito (promo o WhatsApp) no estaría de más.",
      };
    }
    return {
      tone: "bad" as const,
      title: `Va mal ${periodHint}`,
      line: lowPromo
        ? "Se siente apagado y además se te acaban promos. Toca reaccionar: duplica o crea algo nuevo ya."
        : "Poco movimiento y peores números que antes. Amplía fechas solo si quieres contexto; si no, actúa en caja y promos.",
    };
  }, [overview, emptyRange, kpis, filters.preset]);

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

  const segmentChips: { id: CustomerSegment; label: string; count?: number }[] =
    [
      { id: "todos", label: "Todos", count: customers.length },
      { id: "nuevos", label: "Nuevos", count: overview?.segments?.nuevos },
      { id: "activos", label: "Activos", count: overview?.segments?.activos },
      {
        id: "cercaCanje",
        label: "Cerca de canje",
        count: overview?.segments?.cercaCanje,
      },
      {
        id: "enRiesgo",
        label: "En riesgo",
        count: overview?.segments?.enRiesgo,
      },
      { id: "vip", label: "VIP", count: overview?.segments?.vip },
      {
        id: "dormidos",
        label: "Dormidos",
        count: overview?.segments?.dormidos,
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
          <div className="flex flex-nowrap items-center justify-end gap-2">
            <OndaSelect
              aria-label="Sede"
              value={storeId}
              onChange={setStoreId}
              placeholder="Sede"
              compact
              options={stores.map((s) => ({ id: s.id, label: s.name }))}
            />
            <div className="shrink-0">
              <SegmentedControl
                aria-label="Modo"
                value={mode}
                onChange={setMode}
                options={[
                  { id: "global", label: "Global" },
                  { id: "event", label: "Evento" },
                ]}
              />
            </div>
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
        {["resumen", "clientes", "actividad", "promos"].includes(tab) ? (
          <AnalyticsFiltersBar
            value={filters}
            onChange={setFilters}
            showPromoTypes={
              tab !== "actividad" || txTypeFilter !== "ACCUMULATE"
            }
            extraGroups={
              tab === "actividad"
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
                            { id: "ALL", label: "Todos" },
                            { id: "ACCUMULATE", label: "Acumular" },
                            { id: "REDEEM", label: "Canjear" },
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
                              { id: "active", label: "Activas" },
                              { id: "inactive", label: "Inactivas" },
                              { id: "all", label: "Todas" },
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
              <div className="onda-kpi-grid">
                <KpiCard
                  label="Ondas en periodo"
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
              <div className="grid gap-3 md:grid-cols-3">
                {overview.insights.map((ins: any) => (
                  <InsightCard
                    key={ins.id}
                    tone={ins.tone}
                    title={ins.title}
                    message={ins.message}
                    action={ins.action}
                    onAction={() => handleInsightAction(ins.id, ins.promoId)}
                  />
                ))}
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
              <div className="onda-card flex flex-col p-5 lg:col-span-2">
                <h3 className="font-display font-semibold">
                  Ondas y canjes por día
                </h3>
                <div className="mt-4 h-64 min-h-[16rem] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview?.series || []}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => String(v).slice(5)}
                        fontSize={11}
                      />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="ondas"
                        name="Ondas"
                        fill="#3DB9E8"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="canjes"
                        name="Canjes"
                        fill="#6E5AE6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <ActivityTimeline
                className="max-h-[22rem] lg:max-h-none lg:h-auto"
                items={(overview?.recent || []).map((t: any) => ({
                  id: t.id,
                  title: t.type === "ACCUMULATE" ? "Acumulación" : "Redención",
                  subtitle:
                    t.promotion?.title ||
                    (t.type === "REDEEM"
                      ? promoTypeLabel(t.promotion?.type)
                      : "Onda"),
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
              {showHourly ? (
                <div className="onda-card p-5">
                  <h3 className="font-display font-semibold">
                    Heat horario (último día)
                  </h3>
                  <div className="mt-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview?.hourly || []}>
                        <XAxis dataKey="hour" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="ondas"
                          stroke="#3DB9E8"
                          strokeWidth={2}
                          name="Ondas"
                        />
                        <Line
                          type="monotone"
                          dataKey="canjes"
                          stroke="#6E5AE6"
                          strokeWidth={2}
                          name="Canjes"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="onda-card p-5">
                  <h3 className="font-display font-semibold">
                    Cobertura de catálogo
                  </h3>
                  <p className="mt-4 font-display text-4xl font-semibold">
                    {kpis?.coberturaCatalogo ?? 0}%
                  </p>
                  <p className="mt-2 text-sm text-[var(--onda-muted)]">
                    Clientes que ya alcanzan ≥1 promo activa del filtro.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "clientes" && (
          <div className="space-y-4">
            {(overview?.insights || [])
              .filter((i: any) => ["near-redeem", "at-risk"].includes(i.id))
              .slice(0, 2)
              .map((ins: any) => (
                <InsightCard
                  key={ins.id}
                  tone={ins.tone}
                  title={ins.title}
                  message={ins.message}
                  action={ins.action}
                  onAction={() => handleInsightAction(ins.id, ins.promoId)}
                />
              ))}

            <div className="flex flex-wrap gap-1.5">
              {segmentChips.map((c) => (
                <FilterChip
                  key={c.id}
                  selected={segment === c.id}
                  onClick={() => setSegment(c.id)}
                >
                  {c.label}
                  {c.count != null ? ` · ${c.count}` : ""}
                </FilterChip>
              ))}
            </div>

            <div className="onda-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--onda-border)] p-4">
                <h3 className="font-display font-semibold">
                  CRM · {filteredCustomers.length} clientes
                </h3>
                <GradientButton type="button" onClick={exportCsv}>
                  Exportar CSV
                </GradientButton>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
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
                        className="border-t border-[var(--onda-border)]"
                      >
                        <td className="p-3">{c.user.name}</td>
                        <td className="p-3">{displayPhone(c.user.phone)}</td>
                        <td className="p-3">{c.points}</td>
                        <td className="p-3 text-xs text-[var(--onda-muted)]">
                          {c.lastVisit
                            ? new Date(c.lastVisit).toLocaleDateString("es-CO")
                            : "—"}
                        </td>
                        <td className="p-3">{c.visitsInRange}</td>
                        <td className="p-3">
                          {c.badge ? (
                            <span className="rounded-full bg-[var(--onda-violet-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-violet)]">
                              {c.badge}
                            </span>
                          ) : (
                            "—"
                          )}
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
                label="Ondas última hora"
                value={overview?.ops?.ondasLastHour ?? 0}
              />
              <KpiCard
                label="Acumular / Canjear"
                value={`${overview?.ops?.accumulateInRange ?? 0} / ${overview?.ops?.redeemInRange ?? 0}`}
              />
              <KpiCard
                label="Desde última tx"
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
              <InsightCard
                tone="warning"
                title="Caja fría"
                message="Lleva más de 90 minutos sin movimientos. Revisa QR/NFC o el PIN de caja."
                action="Ir a acumular"
              />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="onda-card space-y-3 p-5">
                <h3 className="font-display font-semibold">
                  Sumar onda (PIN caja)
                </h3>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Pass ID"
                  value={passId}
                  onChange={(e) => setPassId(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                <GradientButton type="button" onClick={accumulate}>
                  Acumular
                </GradientButton>
              </div>
              <div className="onda-card p-5">
                <h3 className="font-display font-semibold">
                  Auditoría filtrada
                </h3>
                <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
                  {txs.map((t: any) => (
                    <li
                      key={t.id}
                      className="flex justify-between gap-3 border-b border-[var(--onda-border)] py-2"
                    >
                      <span>
                        {t.type === "ACCUMULATE" ? "Acumular" : "Canjear"} ·{" "}
                        {t.pass?.user?.name || "—"}
                        {t.promotion ? (
                          <span className="text-[var(--onda-muted)]">
                            {" "}
                            · {promoTypeLabel(t.promotion.type)}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[var(--onda-muted)]">
                        {t.type === "ACCUMULATE" ? "+" : "−"}
                        {t.points}
                      </span>
                    </li>
                  ))}
                  {!txs.length ? (
                    <li className="py-4 text-[var(--onda-muted)]">
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
                  {showPromoForm ? "Cerrar" : "+ Nueva promo"}
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
                    {promoBusy ? "Guardando…" : "Crear promoción"}
                  </GradientButton>
                </div>
              </form>
            )}

            <div
              className={
                promoView === "grid"
                  ? "grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
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
                className="onda-card flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">{m.event?.name}</p>
                  <p className="text-sm text-[var(--onda-muted)]">
                    {m.customPromo || "Sin promo"}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--onda-violet-soft)] px-3 py-1 text-xs text-[var(--onda-violet)]">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "pase" && design && (
          <div className="onda-pass-designer-layout">
            <form
              onSubmit={saveDesign}
              className="onda-card onda-pass-designer p-6"
            >
              <h3 className="font-display text-lg font-semibold">
                Pass Designer
              </h3>

              <div className="onda-pass-designer-brand">
                <ImageUploadField
                  label="Logo"
                  hint="JPG, PNG o WEBP"
                  aspectClass="aspect-square"
                  className="onda-pass-designer-logo"
                  value={design.logoUrl || ""}
                  onChange={(logoUrl) => setDesign({ ...design, logoUrl })}
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
                    El texto y las etiquetas se ajustan solos para contraste y
                    jerarquía.
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
                        setDesign({ ...design, subtitle: e.target.value })
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
                      setDesign({ ...design, description: e.target.value })
                    }
                  />
                </label>

                <div className="flex justify-end pt-1">
                  <GradientButton type="submit">Guardar preview</GradientButton>
                </div>
              </div>
            </form>

            <div className="onda-pass-designer-preview">
              <p className="onda-pass-designer-label mb-3">Vista previa</p>
              <PassPreview {...design} points={12} memberName="Cliente demo" />
            </div>
          </div>
        )}

        {tab === "config" && (
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
                  Upgrade a PRO (Wompi sandbox)
                </GradientButton>
              ) : null}
            </div>
            <div className="onda-card p-5">
              <h3 className="font-display font-semibold">Features PRO</h3>
              <ul className="mt-3 space-y-1 text-sm text-[var(--onda-muted)]">
                <li>
                  Review gating: {billing?.features?.reviewGating ? "Sí" : "No"}
                </li>
                <li>NPS: {billing?.features?.npsSurveys ? "Sí" : "No"}</li>
                <li>GPS: {billing?.features?.gpsProximity ? "Sí" : "No"}</li>
              </ul>
            </div>
          </div>
        )}
      </AppShell>
      {dialogs}
    </>
  );
}
