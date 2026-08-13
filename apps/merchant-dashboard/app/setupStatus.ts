export type StoreSetupFields = {
  id?: string;
  passDesign?: { logoUrl?: string | null } | null;
  _count?: { promotions?: number } | null;
  promotions?: unknown[] | null;
};

export type StoreSetupStatus = {
  hasCard: boolean;
  hasPromo: boolean;
  complete: boolean;
  doneCount: number;
  promoCount: number;
};

const SETUP_ALLOWED_TABS = new Set(["completar", "promos", "config"]);

export function storeSetupStatus(
  store: StoreSetupFields | null | undefined,
): StoreSetupStatus {
  const hasCard = Boolean(store?.passDesign?.logoUrl?.trim());
  const promoCount =
    store?._count?.promotions ?? store?.promotions?.length ?? 0;
  const hasPromo = promoCount > 0;
  return {
    hasCard,
    hasPromo,
    complete: hasCard && hasPromo,
    doneCount: Number(hasCard) + Number(hasPromo),
    promoCount,
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
