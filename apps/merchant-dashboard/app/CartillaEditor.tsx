"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  api,
  formatPromoBenefit,
  GradientButton,
  OndaDatePicker,
  OndaIcons,
  SegmentedControl,
  toast,
  useOndaDialogs,
} from "@onda/shared-ui";
import {
  cartillaDeadlineLabel,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from "@onda/shared-utils";
import { PassDesigner } from "./PassDesigner";
import { CreatePromo } from "./CreatePromo";

const CYCLES = ["2", "4", "6", "8", "10", "12"] as const;

function snapCycle(n: number) {
  const allowed = [2, 4, 6, 8, 10, 12];
  if (allowed.includes(n)) return n;
  return allowed.reduce((best, x) =>
    Math.abs(x - n) < Math.abs(best - n) ? x : best,
  );
}

function isBetterWelcome(a: any, b: any) {
  if (!a || !b) return true;
  if (a.type !== b.type) return false;
  if (a.type === "PERCENT_OFF" || a.type === "AMOUNT_OFF") {
    return Number(a.value || 0) >= Number(b.value || 0);
  }
  if (a.type === "BUY_GET") {
    const ra =
      Number(a.getQuantity || 0) / Math.max(1, Number(a.buyQuantity || 1));
    const rb =
      Number(b.getQuantity || 0) / Math.max(1, Number(b.buyQuantity || 1));
    return ra >= rb;
  }
  return true;
}

function brandColorsFromStore(store: {
  passDesign?: {
    backgroundColor?: string | null;
    foregroundColor?: string | null;
    labelColor?: string | null;
  } | null;
} | null) {
  const brand = store?.passDesign;
  return {
    backgroundColor: brand?.backgroundColor || DEFAULT_BRAND_PRIMARY,
    foregroundColor: brand?.foregroundColor || "#FFFFFF",
    labelColor: brand?.labelColor || DEFAULT_BRAND_SECONDARY,
  };
}

function poolLabel(pool: string) {
  return pool === "BIENVENIDA" ? "Adquisición" : "Retención";
}

export function CartillaEditor({
  storeId,
  store,
  cartillaId,
  onClose,
  embedded = false,
  onSaved,
  onPromoCreated,
}: {
  storeId: string;
  store: {
    maxStamps?: number;
    name?: string;
    passDesign?: {
      logoUrl?: string | null;
      backgroundColor?: string | null;
      foregroundColor?: string | null;
      labelColor?: string | null;
    } | null;
  } | null;
  cartillaId: string | "nueva";
  onClose: () => void;
  embedded?: boolean;
  onSaved?: (cartilla: any) => void;
  onPromoCreated?: (promo: any) => void | Promise<void>;
}) {
  const { confirm, alert, dialogs } = useOndaDialogs();
  const [name, setName] = useState(embedded ? "Cartilla base" : "Cartilla");
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isDefault, setIsDefault] = useState(embedded);
  const [status, setStatus] = useState("DRAFT");
  const [passCount, setPassCount] = useState(0);
  const [maxStamps, setMaxStamps] = useState(() =>
    snapCycle(store?.maxStamps ?? 12),
  );
  const [promos, setPromos] = useState<any[]>([]);
  const [slots, setSlots] = useState<
    { promotionId: string; pointsRequired: number }[]
  >([]);
  const [picking, setPicking] = useState(false);
  const [pendingPromo, setPendingPromo] = useState<any | null>(null);
  const [pickPool, setPickPool] = useState<"ALL" | "BIENVENIDA" | "RETENCION">(
    "ALL",
  );
  const [design, setDesign] = useState<any>(() => ({
    title: store?.name || "Onda",
    subtitle: "Programa de lealtad",
    description: "",
    ...brandColorsFromStore(store),
    logoUrl: "",
  }));
  const [busy, setBusy] = useState(false);

  const storeLogoUrl = store?.passDesign?.logoUrl || "";

  useEffect(() => {
    if (cartillaId !== "nueva") return;
    void api<any>(`/pass-designs/store/${storeId}`).then((storeDesign) => {
      setDesign((prev: any) => ({
        ...prev,
        title: prev.title || store?.name || storeDesign.title || "Onda",
        subtitle: storeDesign.subtitle || prev.subtitle || "Programa de lealtad",
        description: storeDesign.description || prev.description || "",
        backgroundColor:
          storeDesign.backgroundColor ||
          prev.backgroundColor ||
          DEFAULT_BRAND_PRIMARY,
        foregroundColor:
          storeDesign.foregroundColor || prev.foregroundColor || "#FFFFFF",
        labelColor:
          storeDesign.labelColor ||
          prev.labelColor ||
          DEFAULT_BRAND_SECONDARY,
        logoUrl: prev.logoUrl || storeDesign.logoUrl || "",
      }));
    });
  }, [cartillaId, storeId, store?.name]);

  useEffect(() => {
    void api<any[]>(`/promotions?storeId=${storeId}&isActive=true`).then(
      setPromos,
    );
  }, [storeId]);

  function openCreatePromo() {
    setPicking(false);
    setPendingPromo(null);
    setCreatingPromo(true);
  }

  async function handlePromoCreated(promo: any) {
    setPromos((prev) =>
      prev.some((p) => p.id === promo.id) ? prev : [...prev, promo],
    );
    setPendingPromo(promo);
    setPicking(true);
    setCreatingPromo(false);
    await onPromoCreated?.(promo);
  }

  useEffect(() => {
    if (cartillaId === "nueva") return;
    void api<any>(`/cartillas/${cartillaId}`).then((c) => {
      setName(c.name);
      setIsDefault(Boolean(c.isDefault));
      setStatus(c.status);
      setPassCount(Number(c.passCount) || 0);
      setMaxStamps(snapCycle(c.maxStamps ?? store?.maxStamps ?? 12));
      setStartsAt(c.startsAt ? String(c.startsAt).slice(0, 10) : "");
      setEndsAt(c.endsAt ? String(c.endsAt).slice(0, 10) : "");
      if (c.passDesign) setDesign(c.passDesign);
      setSlots(
        (c.items || []).map((i: any) => ({
          promotionId: i.promotionId,
          pointsRequired: i.pointsRequired,
        })),
      );
    });
  }, [cartillaId, store?.maxStamps]);

  const selected = useMemo(() => {
    const byId = new Map(promos.map((p) => [p.id, p]));
    return slots
      .filter((s) => s.pointsRequired <= maxStamps)
      .map((s) => {
        const p = byId.get(s.promotionId);
        if (!p) return null;
        return { ...p, pointsRequired: s.pointsRequired };
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          Number(a.pointsRequired) - Number(b.pointsRequired) ||
          String(a.pool).localeCompare(String(b.pool)),
      );
  }, [promos, slots, maxStamps]);

  const warnings = useMemo(() => {
    const byWave = new Map<number, { bienvenida?: any; retencion?: any }>();
    for (const p of selected) {
      const slot = byWave.get(p.pointsRequired) || {};
      if (p.pool === "BIENVENIDA") slot.bienvenida = p;
      else slot.retencion = p;
      byWave.set(p.pointsRequired, slot);
    }
    return [...byWave.entries()]
      .filter(
        ([, pair]) =>
          pair.bienvenida &&
          pair.retencion &&
          !isBetterWelcome(pair.bienvenida, pair.retencion),
      )
      .map(([n]) => n);
  }, [selected]);

  const pickList = useMemo(() => {
    return promos
      .filter((p) => (pickPool === "ALL" ? true : p.pool === pickPool))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [promos, pickPool]);

  const ondaOptions = useMemo(
    () =>
      Array.from({ length: maxStamps }, (_, i) => String(i + 1)).map((n) => ({
        id: n,
        label: n,
      })),
    [maxStamps],
  );

  function addPromo(promo: any, onda: number) {
    setSlots((current) => {
      const withoutSame = current.filter((s) => {
        if (s.promotionId === promo.id) return false;
        const other = promos.find((p) => p.id === s.promotionId);
        if (!other) return true;
        return !(other.pool === promo.pool && s.pointsRequired === onda);
      });
      return [...withoutSame, { promotionId: promo.id, pointsRequired: onda }];
    });
    setPendingPromo(null);
    setPicking(false);
  }

  function removePromo(id: string) {
    setSlots((current) => current.filter((s) => s.promotionId !== id));
  }

  async function saveDesign(cartillaTargetId: string) {
    const logoForCartilla = design.logoUrl?.trim() || null;
    await api(`/pass-designs/cartilla/${cartillaTargetId}`, {
      method: "PUT",
      body: JSON.stringify({
        ...design,
        logoUrl: logoForCartilla,
      }),
    });

    if (embedded) {
      await api(`/pass-designs/store/${storeId}`, {
        method: "PUT",
        body: JSON.stringify({
          logoUrl: design.logoUrl?.trim() || storeLogoUrl.trim() || null,
          stripImageUrl: design.stripImageUrl?.trim() || null,
          title: design.title || store?.name,
          backgroundColor: design.backgroundColor,
          foregroundColor: design.foregroundColor,
          labelColor: design.labelColor,
        }),
      });
    }
  }

  async function saveMeta() {
    const items = selected.map((p: any) => ({
      promotionId: p.id,
      pointsRequired: p.pointsRequired,
    }));
    const body = {
      storeId,
      name: name.trim() || "Cartilla",
      startsAt: isDefault ? null : startsAt || null,
      endsAt: isDefault ? null : endsAt || null,
      maxStamps,
      items,
    };
    if (cartillaId === "nueva") {
      const created = await api<any>("/cartillas", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await saveDesign(created.id);
      return created;
    }
    const updated = await api<any>(`/cartillas/${cartillaId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await saveDesign(cartillaId);
    return updated;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (embedded && selected.length === 0) {
      toast.danger("Falta una promo", {
        description: "Crea o agrega al menos una promo a la cartilla.",
      });
      return;
    }
    const effectiveLogo = design?.logoUrl?.trim() || storeLogoUrl.trim();
    if (embedded && !effectiveLogo) {
      toast.danger("Falta el logo", {
        description:
          "Sube el logo de tu negocio. Quedará guardado para todas tus cartillas.",
      });
      return;
    }
    setBusy(true);
    try {
      const saved = await saveMeta();
      toast.success("Cartilla guardada");
      onSaved?.({
        ...saved,
        _storeLogoUrl:
          design.logoUrl?.trim() || storeLogoUrl.trim() || null,
        passDesign: {
          ...design,
          logoUrl: design.logoUrl?.trim() || storeLogoUrl.trim() || null,
        },
      });
      if (!embedded) onClose();
    } catch (err: any) {
      toast.danger("No se pudo guardar", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    const ok = await confirm({
      title: "¿Activar esta cartilla?",
      message:
        "Quedará como la única vigente. Si hay otra ocasional activa, se termina y los clientes vuelven a la base cuando esta acabe.",
      confirmLabel: "Activar",
      tone: "accent",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const saved = await saveMeta();
      await api(`/cartillas/${saved.id}/activate`, { method: "POST" });
      toast.success("Cartilla activada", {
        description:
          "Quedó como la única vigente. El ciclo de ondas se reinició para tus clientes.",
      });
      onClose();
    } catch (err: any) {
      toast.danger("No se pudo activar", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function endIt() {
    setBusy(true);
    try {
      await api(`/cartillas/${cartillaId}/end`, { method: "POST" });
      toast.success("Volviste a la cartilla base");
      onClose();
    } catch (err: any) {
      toast.danger("No se pudo terminar", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {creatingPromo ? (
        <CreatePromo
          storeId={storeId}
          store={store}
          confirm={confirm}
          alert={alert}
          backLabel="← Cartilla"
          onClose={() => setCreatingPromo(false)}
          onCreated={handlePromoCreated}
        />
      ) : null}

      <div className={creatingPromo ? "hidden" : "space-y-5"}>
        {embedded ? null : (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
          >
            ← Promociones
          </button>
        )}
        <div>
          <h2 className="font-display text-xl font-semibold">
            {embedded
              ? "Tu cartilla"
              : cartillaId === "nueva"
                ? "Nueva cartilla"
                : name}
          </h2>
          <p className="text-sm text-[var(--onda-muted)]">
            Elige cuántas ondas tiene, crea o agrega promos y decide en qué onda
            se reclaman.
          </p>
        </div>

        {passCount > 0 ? (
          <p className="rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
            {passCount} cliente{passCount === 1 ? "" : "s"} ya{" "}
            {passCount === 1 ? "tiene" : "tienen"} esta cartilla. Los cambios se
            aplican a {passCount === 1 ? "su pase" : "sus pases"}.
          </p>
        ) : null}

        <form onSubmit={onSave} className="onda-card space-y-4 p-5">
          <fieldset className="space-y-4">
            <input
              required
              className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la cartilla"
            />
            {!isDefault ? (
              <div className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <OndaDatePicker
                    label="Inicio"
                    value={startsAt}
                    onChange={setStartsAt}
                  />
                  <OndaDatePicker
                    label="Fin"
                    value={endsAt}
                    onChange={setEndsAt}
                  />
                </div>
                <p className="text-xs text-[var(--onda-muted)]">
                  En esas fechas reemplaza a la cartilla base. Hasta el día de
                  fin se puede acumular y redimir. No puede cruzarse con otra
                  ocasional.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--onda-muted)]">
                Plantilla base: sin fecha límite. Está vigente salvo que una
                ocasional cubra el día de hoy.
              </p>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">Ondas de la cartilla</p>
              <SegmentedControl
                aria-label="Cantidad de ondas"
                value={String(maxStamps)}
                onChange={(id) => setMaxStamps(Number(id))}
                options={CYCLES.map((n) => ({ id: n, label: n }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Promos en esta cartilla</p>
                <div className="flex flex-wrap gap-2">
                  {promos.length === 0 ? (
                    <GradientButton type="button" onClick={openCreatePromo}>
                      {OndaIcons.plus}
                      Crear promo
                    </GradientButton>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium"
                        onClick={openCreatePromo}
                      >
                        {OndaIcons.plus}
                        Crear promo
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium"
                        onClick={() => setPicking(true)}
                      >
                        Agregar promo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selected.length === 0 ? (
                <p className="text-sm text-[var(--onda-muted)]">
                  Aún no hay promos. Créala acá o agrégala y elige en qué onda
                  se reclama.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.map((p: any) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--onda-border)] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          Onda {p.pointsRequired} · {p.title}
                        </p>
                        <p className="text-xs text-[var(--onda-muted)]">
                          {poolLabel(p.pool)} ·{" "}
                          {formatPromoBenefit({ ...p, pointsRequired: 0 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-1.5 text-[var(--onda-muted)] hover:text-[var(--onda-danger)]"
                        aria-label={`Quitar ${p.title}`}
                        onClick={() => removePromo(p.id)}
                      >
                        {OndaIcons.close}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {warnings.length > 0 ? (
                <p className="text-xs text-amber-800">
                  En la onda {warnings.join(", ")} conviene que Adquisición sea
                  más atractiva que Retención.
                </p>
              ) : null}
            </div>

            {picking ? (
              <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Elige una promo</p>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
                    onClick={() => {
                      setPicking(false);
                      setPendingPromo(null);
                    }}
                  >
                    Cerrar
                  </button>
                </div>
                {pendingPromo ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--onda-muted)]">
                      ¿En qué onda se reclama «{pendingPromo.title}»?
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ondaOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-sm font-medium hover:border-[var(--onda-violet)]"
                          onClick={() => addPromo(pendingPromo, Number(opt.id))}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--onda-muted)]"
                      onClick={() => setPendingPromo(null)}
                    >
                      Elegir otra promo
                    </button>
                  </div>
                ) : (
                  <>
                    <SegmentedControl
                      aria-label="Filtrar bolsa"
                      value={pickPool}
                      onChange={setPickPool}
                      options={[
                        { id: "ALL", label: "Ambas" },
                        { id: "BIENVENIDA", label: "Adquisición" },
                        { id: "RETENCION", label: "Retención" },
                      ]}
                    />
                    <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                      {pickList.length === 0 ? (
                        <li className="space-y-3">
                          <p className="text-sm text-[var(--onda-muted)]">
                            No hay promos activas en la bolsa. Crea una primero.
                          </p>
                          <GradientButton
                            type="button"
                            onClick={openCreatePromo}
                          >
                            {OndaIcons.plus}
                            Crear promo
                          </GradientButton>
                        </li>
                      ) : (
                        pickList.map((p) => {
                          const already = slots.some(
                            (s) => s.promotionId === p.id,
                          );
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-2.5 text-left hover:border-[var(--onda-violet)]"
                                onClick={() => setPendingPromo(p)}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    {p.title}
                                  </span>
                                  <span className="block text-xs text-[var(--onda-muted)]">
                                    {poolLabel(p.pool)} ·{" "}
                                    {formatPromoBenefit({
                                      ...p,
                                      pointsRequired: 0,
                                    })}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-medium text-[var(--onda-violet)]">
                                  {already ? "Cambiar onda" : "Seleccionar"}
                                </span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <GradientButton type="submit" disabled={busy}>
              {OndaIcons.save}
              {busy ? "Guardando…" : "Guardar"}
            </GradientButton>
            {!isDefault && status !== "ACTIVE" ? (
              <button
                type="button"
                className="rounded-full border border-[var(--onda-border)] px-4 py-2 text-sm font-medium"
                onClick={() => void activate()}
                disabled={busy}
              >
                Activar ahora
              </button>
            ) : null}
            {!isDefault && status === "ACTIVE" ? (
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--onda-danger)]"
                onClick={() => void endIt()}
                disabled={busy}
              >
                Terminar y volver a la cartilla base
              </button>
            ) : null}
          </div>
        </form>

        <PassDesigner
          design={design}
          onChange={setDesign}
          maxStamps={maxStamps}
          onMaxStampsChange={() => undefined}
          milestoneStamps={selected.map((p: any) => Number(p.pointsRequired))}
          lockCycle
          requireLogo={embedded}
          storeLogoUrl={storeLogoUrl}
          logoHint={
            embedded
              ? "Obligatorio. Se guarda como logo del negocio, junto con los colores, y aparece en todas tus cartillas."
              : undefined
          }
          deadlineLabel={cartillaDeadlineLabel(
            isDefault ? null : endsAt || null,
            isDefault,
          )}
          saveLabel="Guardar diseño"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(e);
          }}
        />
      </div>
      {dialogs}
    </div>
  );
}
