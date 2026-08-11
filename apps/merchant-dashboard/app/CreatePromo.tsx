"use client";

import { useState, type FormEvent } from "react";
import {
  GradientButton,
  FilterChip,
  ImageUploadField,
  InfoTooltip,
  PROMO_TYPE_OPTIONS,
  formatPromoBenefit,
  api,
  toast,
  type PromoTypeKey,
  OndaIcons,
} from "@onda/shared-ui";

type PromoFormState = {
  title: string;
  description: string;
  pointsRequired: string;
  imageUrl: string;
  isActive: boolean;
  type: PromoTypeKey;
  value: string;
  buyQuantity: string;
  getQuantity: string;
  productName: string;
  expiryMode: "" | "TIME" | "QUANTITY";
  endsAt: string;
  maxRedemptions: string;
};

type DialogTone = "default" | "success" | "warning" | "danger" | "accent";

const EMPTY_FORM: PromoFormState = {
  title: "",
  description: "",
  pointsRequired: "5",
  imageUrl: "",
  isActive: true,
  type: "PRODUCT",
  value: "",
  buyQuantity: "2",
  getQuantity: "1",
  productName: "",
  expiryMode: "",
  endsAt: "",
  maxRedemptions: "",
};

function formFromSource(source: any): PromoFormState {
  return {
    title: source.title || "",
    description: source.description || "",
    pointsRequired: String(source.pointsRequired ?? 5),
    imageUrl: source.imageUrl || "",
    isActive: true,
    type: (source.type as PromoTypeKey) || "PRODUCT",
    value: source.value != null ? String(source.value) : "",
    buyQuantity: source.buyQuantity != null ? String(source.buyQuantity) : "2",
    getQuantity: source.getQuantity != null ? String(source.getQuantity) : "1",
    productName: source.productName || "",
    expiryMode: "",
    endsAt: "",
    maxRedemptions: "",
  };
}

export function CreatePromo({
  storeId,
  store,
  duplicateFrom,
  confirm,
  alert,
  onCreated,
  onClose,
}: {
  storeId: string;
  store: { maxStamps?: number } | null;
  duplicateFrom?: any;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: DialogTone;
  }) => Promise<boolean>;
  alert: (opts: {
    title: string;
    message: string;
    actionLabel?: string;
    tone?: DialogTone;
  }) => Promise<void>;
  onCreated: (promo: any) => void | Promise<void>;
  onClose: () => void;
}) {
  const initialForm = duplicateFrom ? formFromSource(duplicateFrom) : EMPTY_FORM;
  const [form, setForm] = useState<PromoFormState>(initialForm);
  const [busy, setBusy] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  async function handleBack() {
    if (isDirty) {
      const ok = await confirm({
        title: "¿Descartar cambios?",
        message: "Vas a perder lo que escribiste en esta promo.",
        confirmLabel: "Descartar",
        cancelLabel: "Seguir editando",
        tone: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }

  const promoPreview = formatPromoBenefit({
    ...form,
    value: form.value ? Number(form.value) : null,
    buyQuantity: Number(form.buyQuantity) || null,
    getQuantity: Number(form.getQuantity) || null,
    pointsRequired: Number(form.pointsRequired) || 0,
  });

  async function createPromo(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !form.title.trim()) return;
    if (!form.expiryMode) {
      await alert({
        title: "Caducidad requerida",
        message:
          "Indica si la promo caduca por tiempo o por cantidad de redenciones.",
        tone: "warning",
      });
      return;
    }
    if (form.expiryMode === "TIME" && !form.endsAt) {
      await alert({
        title: "Fecha requerida",
        message: "Indica hasta cuándo estará disponible.",
        tone: "warning",
      });
      return;
    }
    if (
      form.expiryMode === "QUANTITY" &&
      (!form.maxRedemptions || Number(form.maxRedemptions) < 1)
    ) {
      await alert({
        title: "Cantidad requerida",
        message: "Indica el máximo de redenciones.",
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        storeId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        pointsRequired: Number(form.pointsRequired) || 1,
        imageUrl: form.imageUrl || undefined,
        isActive: form.isActive,
        type: form.type,
        expiryMode: form.expiryMode,
      };
      if (form.expiryMode === "TIME") body.endsAt = form.endsAt;
      if (form.expiryMode === "QUANTITY") {
        body.maxRedemptions = Number(form.maxRedemptions);
      }
      if (form.type === "PERCENT_OFF" || form.type === "AMOUNT_OFF") {
        body.value = Number(form.value) || 0;
      }
      if (form.type === "BUY_GET") {
        body.buyQuantity = Number(form.buyQuantity) || 1;
        body.getQuantity = Number(form.getQuantity) || 1;
      }
      if (form.type === "PRODUCT") {
        body.productName = form.productName.trim() || form.title.trim();
        if (form.value) body.value = Number(form.value);
      }
      const promo = await api("/promotions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Promoción creada", {
        description: "Ya está disponible para tus clientes.",
      });
      await onCreated(promo);
    } catch (err: any) {
      await alert({
        title: "Error al crear promo",
        message: err.message || "Intenta de nuevo.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleBack}
        className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
      >
        ← Todas las promociones
      </button>

      <div>
        <h2 className="font-display text-xl font-semibold">Nueva promoción</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Define el beneficio, el vencimiento y cuántas ondas cuesta.
        </p>
      </div>

      <form
        onSubmit={createPromo}
        className="onda-card grid gap-5 p-5 lg:grid-cols-[220px_1fr]"
      >
        <div>
          <ImageUploadField
            label="Imagen de la promo"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PROMO_TYPE_OPTIONS.map((t) => (
              <FilterChip
                key={t.id}
                selected={form.type === t.id}
                icon={t.icon}
                onClick={() => setForm((f) => ({ ...f, type: t.id }))}
              >
                {t.label}
              </FilterChip>
            ))}
          </div>
          <input
            required
            placeholder="Título (ej. Postre gratis)"
            className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            placeholder="Descripción opcional"
            rows={2}
            className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          {form.type === "PERCENT_OFF" ? (
            <label className="block text-sm text-[var(--onda-muted)]">
              Porcentaje (1–100)
              <input
                type="number"
                min={1}
                max={100}
                required
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </label>
          ) : null}
          {form.type === "AMOUNT_OFF" ? (
            <label className="block text-sm text-[var(--onda-muted)]">
              Monto off (COP)
              <input
                type="number"
                min={1}
                required
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </label>
          ) : null}
          {form.type === "BUY_GET" ? (
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-[var(--onda-muted)]">
                Compra N
                <input
                  type="number"
                  min={1}
                  required
                  className="ml-2 w-20 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={form.buyQuantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, buyQuantity: e.target.value }))
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
                  value={form.getQuantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, getQuantity: e.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}
          {form.type === "PRODUCT" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[var(--onda-muted)]">
                Nombre del producto
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={form.productName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productName: e.target.value }))
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
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
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
              ¿Cómo caduca? <span className="text-[var(--onda-danger)]">*</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                selected={form.expiryMode === "TIME"}
                icon={OndaIcons.calendar}
                onClick={() =>
                  setForm((f) => ({ ...f, expiryMode: "TIME", maxRedemptions: "" }))
                }
              >
                Por tiempo
              </FilterChip>
              <InfoTooltip text="La promo deja de estar disponible en la fecha que elijas." />
              <FilterChip
                selected={form.expiryMode === "QUANTITY"}
                icon={OndaIcons.nXm}
                onClick={() =>
                  setForm((f) => ({ ...f, expiryMode: "QUANTITY", endsAt: "" }))
                }
              >
                Por cantidad
              </FilterChip>
              <InfoTooltip text="La promo deja de estar disponible al llegar al número de reclamaciones que definas, sin importar la fecha." />
            </div>
            {form.expiryMode === "TIME" ? (
              <label className="block text-sm text-[var(--onda-muted)]">
                Disponible hasta
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endsAt: e.target.value }))
                  }
                />
              </label>
            ) : null}
            {form.expiryMode === "QUANTITY" ? (
              <label className="block text-sm text-[var(--onda-muted)]">
                Máximo de redenciones
                <input
                  type="number"
                  min={1}
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={form.maxRedemptions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
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
                value={form.pointsRequired}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pointsRequired: e.target.value }))
                }
              />
            </label>
            <span className="text-xs text-[var(--onda-muted)]">
              de {store?.maxStamps ?? 12} sellos del ciclo
            </span>
            <label className="flex items-center gap-2 text-sm text-[var(--onda-muted)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="accent-[var(--onda-violet)]"
              />
              Activa al crear
            </label>
          </div>
          <GradientButton type="submit" disabled={busy}>
            {OndaIcons.plus}
            {busy ? "Guardando…" : "Crear promoción"}
          </GradientButton>
        </div>
      </form>
    </div>
  );
}
