"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  api,
  formatPromoBenefit,
  GradientButton,
  OndaIcons,
  SegmentedControl,
  toast,
} from "@onda/shared-ui";
import { PassDesigner } from "./PassDesigner";

const CYCLES = ["4", "6", "8", "10", "12"] as const;

function snapCycle(n: number) {
  const allowed = [4, 6, 8, 10, 12];
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

function poolLabel(pool: string) {
  return pool === "BIENVENIDA" ? "Bienvenida" : "Retención";
}

export function CartillaEditor({
  storeId,
  store,
  cartillaId,
  onClose,
}: {
  storeId: string;
  store: { maxStamps?: number; name?: string } | null;
  cartillaId: string | "nueva";
  onClose: () => void;
}) {
  const [name, setName] = useState("Cartilla");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [status, setStatus] = useState("DRAFT");
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
  const [design, setDesign] = useState<any>({
    title: store?.name || "Onda",
    subtitle: "Programa de lealtad",
    description: "",
    backgroundColor: "#6E5AE6",
    foregroundColor: "#FFFFFF",
    labelColor: "#E5F6FC",
    logoUrl: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<any[]>(`/promotions?storeId=${storeId}&isActive=true`).then(
      setPromos,
    );
  }, [storeId]);

  useEffect(() => {
    if (cartillaId === "nueva") return;
    void api<any>(`/cartillas/${cartillaId}`).then((c) => {
      setName(c.name);
      setIsDefault(Boolean(c.isDefault));
      setStatus(c.status);
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
      if (design) {
        await api(`/pass-designs/cartilla/${created.id}`, {
          method: "PUT",
          body: JSON.stringify(design),
        });
      }
      return created;
    }
    const updated = await api<any>(`/cartillas/${cartillaId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await api(`/pass-designs/cartilla/${cartillaId}`, {
      method: "PUT",
      body: JSON.stringify(design),
    });
    return updated;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveMeta();
      toast.success("Cartilla guardada");
      onClose();
    } catch (err: any) {
      toast.danger("No se pudo guardar", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    try {
      const saved = await saveMeta();
      await api(`/cartillas/${saved.id}/activate`, { method: "POST" });
      toast.success("Cartilla activada", {
        description: "El ciclo de ondas se reinició para tus clientes.",
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
      toast.success("Volviste a la cartilla permanente");
      onClose();
    } catch (err: any) {
      toast.danger("No se pudo terminar", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
      >
        ← Promociones
      </button>
      <div>
        <h2 className="font-display text-xl font-semibold">
          {cartillaId === "nueva" ? "Nueva cartilla" : name}
        </h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Elige cuántas ondas tiene, agrega promos y decide en qué onda se
          reclaman.
        </p>
      </div>

      <form onSubmit={onSave} className="onda-card space-y-4 p-5">
        <input
          required
          className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la cartilla"
        />
        {!isDefault ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--onda-muted)]">
              Inicio
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="text-sm text-[var(--onda-muted)]">
              Fin
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <p className="text-xs text-[var(--onda-muted)]">
            Cartilla permanente: sin fechas. Es el fallback cuando no hay una
            ocasional activa.
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
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium"
              onClick={() => setPicking(true)}
            >
              {OndaIcons.plus}
              Agregar promo
            </button>
          </div>

          {selected.length === 0 ? (
            <p className="text-sm text-[var(--onda-muted)]">
              Aún no hay promos. Agrégalas y elige en qué onda se reclaman.
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
                      {poolLabel(p.pool)} · {formatPromoBenefit({ ...p, pointsRequired: 0 })}
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
              En la onda {warnings.join(", ")} conviene que Bienvenida sea más
              atractiva que Retención.
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
                    { id: "BIENVENIDA", label: "Bienvenida" },
                    { id: "RETENCION", label: "Retención" },
                  ]}
                />
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                  {pickList.length === 0 ? (
                    <li className="text-sm text-[var(--onda-muted)]">
                      No hay promos activas en la bolsa. Crea una primero.
                    </li>
                  ) : (
                    pickList.map((p) => {
                      const already = slots.some((s) => s.promotionId === p.id);
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
              Terminar y volver a permanente
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
        saveLabel="Guardar diseño"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(e);
        }}
      />
    </div>
  );
}
