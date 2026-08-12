# Pantalla dedicada para crear promoción Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract "Crear promoción" in `apps/merchant-dashboard` from an inline toggle-form on the Promociones list page into a dedicated full-screen route (`/promos/nueva`), with a Hero UI toast on success and `InfoTooltip` explanations on the "Por tiempo"/"Por cantidad" expiry chips.

**Architecture:** `MerchantWorkspace.tsx` already navigates by URL for promo detail (`router.push('/promos/${id}')`, parsed by `parseRoute()`). We extend that same convention with a reserved id `"nueva"`. A new sibling component `CreatePromo.tsx` (same pattern as the existing `PromoDetail.tsx`) owns the form's local state, validation, and submit handler that today live inline in `MerchantWorkspace.tsx`. Hero UI's native `Toast`/`ToastProvider` (already a dependency, not yet used anywhere in the repo) is mounted once in `DashboardShell.tsx` and re-exported from `libs/shared/ui`, replacing the need for any custom toast component.

**Tech Stack:** Next.js App Router client components (`apps/merchant-dashboard`), `@heroui/react` v3.2.3 (already installed), `@onda/shared-ui` (`libs/shared/ui`), existing `api()` helper and `useOndaDialogs()` hook.

## Global Constraints

- No Playwright, no E2E tests. Verification is `tsc` + `pnpm exec nx build merchant-dashboard`, plus showing the diff of changed files for manual review — explicit user constraint.
- Out of scope (per spec, do not implement): a third "No caduca" expiry mode; unifying `CreatePromo` and `PromoDetail` into one shared form component; migrating other existing `alert()` success confirmations (togglePromo, plan updated, etc.) to toast.
- Tooltip copy is fixed, do not rephrase:
  - Por tiempo: "La promo deja de estar disponible en la fecha que elijas."
  - Por cantidad: "La promo deja de estar disponible al llegar al número de reclamaciones que definas, sin importar la fecha."
- Toast copy on success: title "Promoción creada", description "Ya está disponible para tus clientes."
- Exiting the create screen with unsaved changes must ask for confirmation via the existing `confirm()` dialog (title "¿Descartar cambios?", message "Vas a perder lo que escribiste en esta promo.", tone `warning`); exiting with no changes closes directly.

---

### Task 1: Add Hero UI's native Toast to `libs/shared/ui` and mount it once in the dashboard shell

**Files:**
- Modify: `libs/shared/ui/src/index.tsx:8`
- Modify: `apps/merchant-dashboard/app/DashboardShell.tsx`

**Interfaces:**
- Consumes: `toast`, `ToastProvider` from `@heroui/react` (already a dependency, confirmed present at `node_modules/@heroui/react/dist/components/toast/`).
- Produces: `toast` (callable as `toast(message, opts)`, `toast.success(message, opts)`, `toast.danger(message, opts)`, with `opts: { description?: ReactNode; timeout?: number; ... }`) and `ToastProvider` (component, props include `placement?: 'top' | 'bottom' | 'top start' | 'top end' | 'bottom start' | 'bottom end'`), both importable from `@onda/shared-ui`. Task 2 consumes `toast`.

This task has no pure logic to unit test (the repo has no test runner, per `CLAUDE.md`) — verification is type-check + visual mount check via the build.

- [ ] **Step 1: Re-export `toast` and `ToastProvider` from shared-ui**

In `libs/shared/ui/src/index.tsx`, change line 8 from:

```tsx
export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker, Tabs } from '@heroui/react';
```

to:

```tsx
export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker, Tabs, toast, ToastProvider } from '@heroui/react';
```

- [ ] **Step 2: Mount `ToastProvider` once in `DashboardShell.tsx`**

Replace the full contents of `apps/merchant-dashboard/app/DashboardShell.tsx` with:

```tsx
"use client";

import { MerchantWorkspace } from "./MerchantWorkspace";
import { ToastProvider } from "@onda/shared-ui";

/** Keeps the workspace mounted across route changes so filters/state survive. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MerchantWorkspace />
      <ToastProvider placement="bottom" />
      <div hidden aria-hidden>
        {children}
      </div>
    </>
  );
}
```

`ToastProvider` renders the visible toast region for the whole app; `toast.success(...)` (called from `CreatePromo.tsx` in Task 2) writes to Hero UI's default internal queue, which this provider reads from without needing a `queue` prop — no extra wiring required.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -p apps/merchant-dashboard/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Show the diff for manual review**

Run: `git diff -- libs/shared/ui/src/index.tsx apps/merchant-dashboard/app/DashboardShell.tsx`
Paste the output back for review — no Playwright/E2E per the user's constraint.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/ui/src/index.tsx apps/merchant-dashboard/app/DashboardShell.tsx
git commit -m "$(cat <<'EOF'
Re-export Hero UI's Toast and mount it in the merchant dashboard shell

Adds toast/ToastProvider to the shared-ui barrel (already a dependency,
previously unused) and mounts the provider once in DashboardShell so any
screen in the merchant dashboard can call toast.success()/toast.danger()
without its own timer/state plumbing. Prep for the create-promo screen's
success toast.
EOF
)"
```

---

### Task 2: Create the `CreatePromo.tsx` screen component

**Files:**
- Create: `apps/merchant-dashboard/app/CreatePromo.tsx`

**Interfaces:**
- Consumes: `GradientButton`, `FilterChip`, `ImageUploadField`, `InfoTooltip`, `PROMO_TYPE_OPTIONS`, `formatPromoBenefit`, `api`, `toast`, `type PromoTypeKey`, `OndaIcons` — all from `@onda/shared-ui` (all already exist except `toast`, added in Task 1).
- Produces: `CreatePromo` component with props:
  ```ts
  {
    storeId: string;
    store: { maxStamps?: number } | null;
    duplicateFrom?: any;
    confirm: (opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent' }) => Promise<boolean>;
    alert: (opts: { title: string; message: string; actionLabel?: string; tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent' }) => Promise<void>;
    onCreated: (promo: any) => void | Promise<void>;
    onClose: () => void;
  }
  ```
  `confirm`/`alert` are the same functions `MerchantWorkspace.tsx` already gets from `useOndaDialogs()` — passed down instead of calling the hook a second time, so the whole page shares one dialog stack. Task 3 wires this up and consumes `CreatePromo`.

No test runner exists for this repo (`CLAUDE.md`) — verification is type-check plus the diff review in the final step.

- [ ] **Step 1: Write `apps/merchant-dashboard/app/CreatePromo.tsx`**

```tsx
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
```

This is the same field set, validation, and submit body as the inline form it replaces (`MerchantWorkspace.tsx` today, `createPromo`/`emptyPromoForm`/the `<form>` JSX) — renamed `promoForm`/`setPromoForm`/`promoBusy` to local `form`/`setForm`/`busy`, plus: the "¿Cómo caduca?" chips now have an `InfoTooltip` next to each, and there's a "← Todas las promociones" back button with an unsaved-changes confirm, matching `PromoDetail.tsx`'s existing back-button style.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -p apps/merchant-dashboard/tsconfig.json`
Expected: no errors. `CreatePromo` isn't imported anywhere yet (that's Task 3), so this only confirms the new file itself is well-typed and its `@onda/shared-ui` imports resolve.

- [ ] **Step 3: Show the diff for manual review**

Run: `git diff -- apps/merchant-dashboard/app/CreatePromo.tsx` (new file, so also run `git status` to confirm it shows as untracked/added)
Paste the output back for review.

- [ ] **Step 4: Commit**

```bash
git add apps/merchant-dashboard/app/CreatePromo.tsx
git commit -m "$(cat <<'EOF'
Add CreatePromo screen component

New sibling to PromoDetail.tsx carrying the promo-creation form's own
state, validation, and submit handler (lifted as-is from the inline
form in MerchantWorkspace.tsx), plus InfoTooltip explanations on the
"Por tiempo"/"Por cantidad" expiry chips and a confirm-before-discard
back button. Not wired into the page yet — that's the next task.
EOF
)"
```

---

### Task 3: Wire `CreatePromo` into `MerchantWorkspace.tsx` as `/promos/nueva`, remove the inline form

**Files:**
- Modify: `apps/merchant-dashboard/app/MerchantWorkspace.tsx`

**Interfaces:**
- Consumes: `CreatePromo` from `./CreatePromo` (Task 2); `confirm`/`alert` from the existing `useOndaDialogs()` call at line 401 (unchanged).
- Produces: nothing consumed by later tasks — this is the last code task.

No test runner exists for this repo — verification is type-check, full build, and diff review.

- [ ] **Step 1: Remove `emptyPromoForm`**

Delete lines 100-114 (the `const emptyPromoForm = {...}` block). It's no longer referenced anywhere in this file after this task.

- [ ] **Step 2: Replace the promo-form state with `duplicateSource`/`justCreatedPromoId`**

Find (around line 381-383):

```tsx
  const [promoForm, setPromoForm] = useState(emptyPromoForm);
  const [promoBusy, setPromoBusy] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
```

Replace with:

```tsx
  const [duplicateSource, setDuplicateSource] = useState<any>(null);
  const [justCreatedPromoId, setJustCreatedPromoId] = useState<string | null>(
    null,
  );
```

- [ ] **Step 3: Guard the promo-detail-analytics effect against the `"nueva"` pseudo-id**

Find (around line 555-556):

```tsx
  useEffect(() => {
    if (!selectedPromoId) {
      setPromoDetail(null);
      return;
    }
```

Replace with:

```tsx
  useEffect(() => {
    if (!selectedPromoId || selectedPromoId === "nueva") {
      setPromoDetail(null);
      return;
    }
```

This stops `/promos/nueva` from triggering a `GET /promotions/nueva/analytics` request (which would 500/404 — `"nueva"` isn't a real promo id).

- [ ] **Step 4: Add `closeCreatePromo` and `handlePromoCreated`, next to `openPromoDetail`/`closePromoDetail`**

Find (around line 609-617):

```tsx
  function openPromoDetail(id: string) {
    setShowPromoForm(false);
    router.push(`/promos/${id}`);
  }

  function closePromoDetail() {
    setPromoDetail(null);
    router.push("/promos");
  }
```

Replace with:

```tsx
  function openPromoDetail(id: string) {
    router.push(`/promos/${id}`);
  }

  function closePromoDetail() {
    setPromoDetail(null);
    router.push("/promos");
  }

  function closeCreatePromo() {
    setDuplicateSource(null);
    router.push("/promos");
  }

  async function handlePromoCreated(promo: any) {
    await loadPromos();
    await loadOverview();
    setJustCreatedPromoId(promo.id);
    setDuplicateSource(null);
    router.push("/promos");
  }
```

- [ ] **Step 5: Remove `createPromo`**

Delete the entire `async function createPromo(e: FormEvent) { ... }` block (lines 831-909 in the current file — starts right after the "Plan actualizado" `alert()` call, ends right before `function duplicatePromo(source: any) {`). Its logic now lives in `CreatePromo.tsx` (Task 2).

- [ ] **Step 6: Rewrite `duplicatePromo`**

Find (around line 911-932):

```tsx
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
```

Replace with:

```tsx
  function duplicatePromo(source: any) {
    setPromoDetail(null);
    setDuplicateSource(source);
    router.push("/promos/nueva");
  }
```

- [ ] **Step 7: Fix `handleInsightAction`'s two "open the create form" branches**

Find (around line 1002-1003, inside the `if (source) { duplicatePromo(source); return; }` branch's fallback):

```tsx
      setShowPromoForm(true);
      router.push("/promos");
      return;
```

Replace with:

```tsx
      router.push("/promos/nueva");
      return;
```

Then find the second occurrence (around line 1013-1014, in the `else if (id === "few-promos" || id === "redeem-drop")` branch):

```tsx
    } else if (id === "few-promos" || id === "redeem-drop") {
      setShowPromoForm(true);
      router.push("/promos");
    } else if (id === "wa-limit") {
```

Replace with:

```tsx
    } else if (id === "few-promos" || id === "redeem-drop") {
      router.push("/promos/nueva");
    } else if (id === "wa-limit") {
```

- [ ] **Step 8: Remove `promoPreview`**

Delete lines 1060-1066 (the `const promoPreview = formatPromoBenefit({...});` block, right before the `return (` of the component). It's now computed locally inside `CreatePromo.tsx`.

- [ ] **Step 9: Import `CreatePromo`, drop the now-unused `PromoTypeKey` import**

Find (line 52):

```tsx
import { PromoDetail } from "./PromoDetail";
```

Replace with:

```tsx
import { PromoDetail } from "./PromoDetail";
import { CreatePromo } from "./CreatePromo";
```

Separately, `PromoTypeKey` (imported from `@onda/shared-ui` in the big import block near the top of the file) was only used inside `emptyPromoForm` (removed in Step 1) and the old `duplicatePromo` body (replaced in Step 6) — after this task it has no remaining uses in this file. Find (line 34, inside that import block):

```tsx
  type PromoTypeKey,
```

Delete that line entirely (the line above it, `OndaIcons,`/`api,` etc. and the line below stay as-is — only remove the `type PromoTypeKey,` line itself).

- [ ] **Step 10: Render `CreatePromo` for `/promos/nueva`, exclude it from the `PromoDetail` branch**

Find (around line 1590-1620):

```tsx
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
```

Replace with:

```tsx
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
```

- [ ] **Step 11: Point the "Nueva promo" button at the new route**

Find (around line 1704-1710):

```tsx
                <GradientButton
                  type="button"
                  onClick={() => setShowPromoForm((v) => !v)}
                >
                  {showPromoForm ? OndaIcons.close : OndaIcons.plus}
                  {showPromoForm ? "Cerrar" : "Nueva promo"}
                </GradientButton>
```

Replace with:

```tsx
                <GradientButton
                  type="button"
                  onClick={() => router.push("/promos/nueva")}
                >
                  {OndaIcons.plus}
                  Nueva promo
                </GradientButton>
```

- [ ] **Step 12: Delete the inline create form**

Delete the entire block from `{showPromoForm && (` through its matching closing `)}` — this is the `<form onSubmit={createPromo} ...>...</form>` that immediately follows the header row edited in Step 11 (lines 1714-1984 in the current file, right before the promo grid/list `<div>` that starts with `promoView === "grid" ...`). Its content is now `CreatePromo.tsx` (Task 2).

- [ ] **Step 13: Highlight the just-created promo in the grid card**

Find (around line 2012):

```tsx
                    className="onda-card cursor-pointer overflow-hidden transition hover:shadow-lg"
```

Replace with:

```tsx
                    className={`onda-card cursor-pointer overflow-hidden transition hover:shadow-lg ${
                      p.id === justCreatedPromoId
                        ? "ring-2 ring-[var(--onda-violet)] ring-offset-2"
                        : ""
                    }`}
```

- [ ] **Step 14: Highlight the just-created promo in the list-row card**

Find (around line 2126):

```tsx
                    className="onda-card flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition hover:shadow-md"
```

Replace with:

```tsx
                    className={`onda-card flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition hover:shadow-md ${
                      p.id === justCreatedPromoId
                        ? "ring-2 ring-[var(--onda-violet)] ring-offset-2"
                        : ""
                    }`}
```

- [ ] **Step 15: Clear the highlight automatically after 4 seconds**

Find the `useEffect` block added/edited in Step 3 (the one guarding `selectedPromoId === "nueva"`) and add a new, separate `useEffect` right after it:

```tsx
  useEffect(() => {
    if (!justCreatedPromoId) return;
    const t = setTimeout(() => setJustCreatedPromoId(null), 4000);
    return () => clearTimeout(t);
  }, [justCreatedPromoId]);
```

- [ ] **Step 16: Type-check**

Run: `pnpm exec tsc -p apps/merchant-dashboard/tsconfig.json`
Expected: no errors. In particular, confirm there are no leftover references to `promoForm`, `setPromoForm`, `promoBusy`, `setPromoBusy`, `showPromoForm`, `setShowPromoForm`, `createPromo`, `emptyPromoForm`, `promoPreview`, or `PromoTypeKey` anywhere in the file (`grep -n "promoForm\|promoBusy\|showPromoForm\|createPromo\|emptyPromoForm\|promoPreview\|PromoTypeKey" apps/merchant-dashboard/app/MerchantWorkspace.tsx` should return nothing).

- [ ] **Step 17: Show the diff for manual review**

Run: `git diff -- apps/merchant-dashboard/app/MerchantWorkspace.tsx`
Paste the output back for review — no Playwright/E2E per the user's constraint.

- [ ] **Step 18: Commit**

```bash
git add apps/merchant-dashboard/app/MerchantWorkspace.tsx
git commit -m "$(cat <<'EOF'
Move promo creation to a dedicated /promos/nueva screen

Replace the inline toggle-form on the Promociones list with a
full-screen route, reusing the same URL-based navigation already used
for promo detail (parseRoute treats "nueva" as a reserved promoId).
duplicatePromo and the two insight-panel "create a promo" actions now
navigate there instead of toggling local form state. The just-created
promo is highlighted in the grid/list for a few seconds on return.
EOF
)"
```

---

### Task 4: Full build verification

**Files:** none (verification only)

**Interfaces:** none — this task only runs commands and reports output.

- [ ] **Step 1: Full type-check**

Run: `pnpm exec tsc -p apps/merchant-dashboard/tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Full production build**

Run: `pnpm exec nx build merchant-dashboard`
Expected: build succeeds with no type errors. This is the "compila" verification the user explicitly asked for.

- [ ] **Step 3: Show the full diff across all three tasks for final review**

Run: `git diff main -- apps/merchant-dashboard libs/shared/ui && git status`
Paste the output back. Per the user's explicit constraint, do not run Playwright, do not start the dev server, and do not attempt any E2E/browser walkthrough — the passing build plus this diff is the complete verification for this change.
