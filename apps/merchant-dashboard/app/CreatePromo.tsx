"use client";

import { useState, type FormEvent } from "react";
import {
  GradientButton,
  FilterChip,
  ImageUploadField,
  PROMO_TYPE_OPTIONS,
  formatPromoBenefit,
  promoDisplayTitle,
  api,
  toast,
  type PromoTypeKey,
  OndaIcons,
} from "@onda/shared-ui";
import { formatMoneyInput, parseMoneyInput } from "@onda/shared-utils";

type PromoFormState = {
  description: string;
  imageUrl: string;
  isActive: boolean;
  type: PromoTypeKey;
  value: string;
  buyQuantity: string;
  getQuantity: string;
  productName: string;
  pool: "BIENVENIDA" | "RETENCION";
  maxRedemptions: string;
};

type DialogTone = "default" | "success" | "warning" | "danger" | "accent";

const EMPTY_FORM: PromoFormState = {
  description: "",
  imageUrl: "",
  isActive: true,
  type: "PRODUCT",
  value: "",
  buyQuantity: "2",
  getQuantity: "1",
  productName: "",
  pool: "RETENCION",
  maxRedemptions: "",
};

function formFromSource(source: any): PromoFormState {
  return {
    description: source.description || "",
    imageUrl: source.imageUrl || "",
    isActive: true,
    type: (source.type as PromoTypeKey) || "PRODUCT",
    value: source.value != null ? String(source.value) : "",
    buyQuantity: source.buyQuantity != null ? String(source.buyQuantity) : "2",
    getQuantity: source.getQuantity != null ? String(source.getQuantity) : "1",
    productName: source.productName || "",
    pool: source.pool === "BIENVENIDA" ? "BIENVENIDA" : "RETENCION",
    maxRedemptions:
      source.maxRedemptions != null ? String(source.maxRedemptions) : "",
  };
}

function conditionsKey(f: PromoFormState) {
  return JSON.stringify({
    type: f.type,
    value: f.value || null,
    buyQuantity: f.buyQuantity || null,
    getQuantity: f.getQuantity || null,
    productName: f.productName || null,
    maxRedemptions: f.maxRedemptions || null,
    pool: f.pool,
  });
}

export function CreatePromo({
  storeId,
  store,
  duplicateFrom,
  confirm,
  alert,
  onCreated,
  onClose,
  backLabel = "← Todas las promociones",
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
  backLabel?: string;
}) {
  const initialForm = duplicateFrom
    ? formFromSource(duplicateFrom)
    : EMPTY_FORM;
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

  const generatedTitle = promoDisplayTitle({
    ...form,
    value: form.value ? Number(form.value) : null,
    buyQuantity: Number(form.buyQuantity) || null,
    getQuantity: Number(form.getQuantity) || null,
  });
  const promoPreview = formatPromoBenefit({
    ...form,
    value: form.value ? Number(form.value) : null,
    buyQuantity: Number(form.buyQuantity) || null,
    getQuantity: Number(form.getQuantity) || null,
  });

  async function createPromo(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    if (form.type === "PRODUCT") {
      if (!form.productName.trim() || !form.value || Number(form.value) <= 0) {
        await alert({
          title: "Falta el producto",
          message:
            "Indica el nombre y el precio del producto para el seguimiento.",
          tone: "warning",
        });
        return;
      }
    }
    if (
      duplicateFrom &&
      conditionsKey(form) === conditionsKey(formFromSource(duplicateFrom))
    ) {
      await alert({
        title: "Cambia una condición",
        message:
          "Para duplicar debes cambiar beneficio, cupo o bolsa. La foto no alcanza.",
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      storeId,
      title: generatedTitle,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl || undefined,
      isActive: form.isActive,
      type: form.type,
      pool: form.pool,
    };
    if (form.maxRedemptions) {
      body.maxRedemptions = Number(form.maxRedemptions);
    }
    if (duplicateFrom?.id) body.duplicatedFromId = duplicateFrom.id;
    if (form.type === "PERCENT_OFF" || form.type === "AMOUNT_OFF") {
      body.value = Number(form.value) || 0;
    }
    if (form.type === "BUY_GET") {
      body.buyQuantity = Number(form.buyQuantity) || 1;
      body.getQuantity = Number(form.getQuantity) || 1;
    }
    if (form.type === "PRODUCT") {
      body.productName = form.productName.trim();
      body.value = Number(form.value);
    }
    let promo: any;
    try {
      promo = await api("/promotions", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      setBusy(false);
      await alert({
        title: "Error al crear promo",
        message: err.message || "Intenta de nuevo.",
        tone: "danger",
      });
      return;
    }
    setBusy(false);
    toast.success("Promoción creada", {
      description: "Ya está disponible para tus clientes.",
    });
    await onCreated(promo);
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleBack}
        className="cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
      >
        {backLabel}
      </button>

      <div>
        <h2 className="font-display text-xl font-semibold">Nueva promoción</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Agrega beneficios a tus clientes.
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
          <p className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-sm font-medium text-[var(--onda-ink)]">
            {generatedTitle}
          </p>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, value: e.target.value }))
                }
              />
            </label>
          ) : null}
          {form.type === "AMOUNT_OFF" ? (
            <label className="block text-sm text-[var(--onda-muted)]">
              Valor de descuento (COP)
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={formatMoneyInput(form.value)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, value: parseMoneyInput(e.target.value) }))
                }
                placeholder="Ej. 8.000"
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
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={form.productName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productName: e.target.value }))
                  }
                  placeholder="Ej. Café americano"
                />
              </label>
              <label className="text-sm text-[var(--onda-muted)]">
                Precio del producto (COP)
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                  value={formatMoneyInput(form.value)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: parseMoneyInput(e.target.value) }))
                  }
                  placeholder="Ej. 8.000"
                />
              </label>
            </div>
          ) : null}

          <p className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-xs text-[var(--onda-muted)]">
            Preview: {promoPreview}
          </p>

          <div className="rounded-xl border border-[var(--onda-border)] p-3 space-y-3">
            <p className="text-sm font-medium text-[var(--onda-ink)]">Bolsa</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                selected={form.pool === "BIENVENIDA"}
                onClick={() => setForm((f) => ({ ...f, pool: "BIENVENIDA" }))}
              >
                Adquisición
              </FilterChip>
              <FilterChip
                selected={form.pool === "RETENCION"}
                onClick={() => setForm((f) => ({ ...f, pool: "RETENCION" }))}
              >
                Retención
              </FilterChip>
            </div>
            {form.pool === "BIENVENIDA" ? (
              <p className="text-xs text-[var(--onda-muted)]">
                Estas promociones serán utilizadas con estrategias comerciales y
                publicitarias administradas por Onda.
              </p>
            ) : null}
            {duplicateFrom ? (
              <p className="text-xs text-amber-800">
                Cambia beneficio, cupo o bolsa para poder guardar el duplicado.
              </p>
            ) : null}
            <label className="block text-sm text-[var(--onda-muted)]">
              Cupo de redenciones (opcional)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                value={form.maxRedemptions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
                }
                placeholder="Sin límite si lo dejas vacío"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
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
          <GradientButton type="submit" disabled={busy || !storeId}>
            {OndaIcons.plus}
            {busy ? "Guardando…" : "Crear promoción"}
          </GradientButton>
        </div>
      </form>
    </div>
  );
}
