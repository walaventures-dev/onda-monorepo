export type StoreSetupFields = {
  id?: string;
  passDesign?: { logoUrl?: string | null } | null;
  _count?: { promotions?: number } | null;
  promotions?: unknown[] | null;
  cartillas?: Array<{
    id?: string;
    isDefault?: boolean;
    _count?: { items?: number } | null;
    items?: unknown[] | null;
  }> | null;
};

export type StoreSetupStatus = {
  hasCartilla: boolean;
  hasPromo: boolean;
  complete: boolean;
  doneCount: number;
  promoCount: number;
  defaultCartillaId: string | null;
};

const SETUP_ALLOWED_TABS = new Set(["completar", "promos", "config"]);

function defaultCartillaOf(store: StoreSetupFields | null | undefined) {
  const list = store?.cartillas || [];
  return list.find((c) => c.isDefault) || list[0] || null;
}

export function storeSetupStatus(
  store: StoreSetupFields | null | undefined,
): StoreSetupStatus {
  const cartilla = defaultCartillaOf(store);
  const itemCount = cartilla?._count?.items ?? cartilla?.items?.length ?? 0;
  const hasCartilla = itemCount > 0;
  const promoCount =
    store?._count?.promotions ?? store?.promotions?.length ?? 0;
  const hasPromo = promoCount > 0;
  return {
    hasCartilla,
    hasPromo,
    complete: hasCartilla && hasPromo,
    doneCount: Number(hasCartilla) + Number(hasPromo),
    promoCount,
    defaultCartillaId: cartilla?.id ?? null,
  };
}

export function isSetupAllowedTab(tab: string | null | undefined) {
  return !!tab && SETUP_ALLOWED_TABS.has(tab);
}

export function isSetupAllowedPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  const first = path.split("/").filter(Boolean)[0];
  return isSetupAllowedTab(first);
}

export function pickPreferredStore<T extends { id: string }>(
  stores: T[],
): T | undefined {
  let preferred = "";
  try {
    preferred = localStorage.getItem("onda-merchant-store-id") || "";
  } catch {
    /* ignore */
  }
  return stores.find((s) => s.id === preferred) || stores[0];
}

export function merchantHomePath(stores: StoreSetupFields[]): string {
  if (!stores.length) return "/onboarding";
  const store = pickPreferredStore(
    stores.filter((s): s is StoreSetupFields & { id: string } => Boolean(s.id)),
  );
  return storeSetupStatus(store).complete ? "/resumen" : "/completar";
}
