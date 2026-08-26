"use client";

import { OndaIcons, SkeletonList } from "@onda/shared-ui";
import { CartillaEditor } from "./CartillaEditor";
import type { StoreSetupStatus } from "./setupStatus";

function TaskBadge({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${
        done
          ? "bg-[color-mix(in_srgb,var(--onda-success)_16%,white)] text-[var(--onda-success)]"
          : "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
      }`}
    >
      {done ? OndaIcons.check : OndaIcons.alert}
    </span>
  );
}

export function SetupChecklist({
  status,
  storeId,
  store,
  cartillaId,
  onCartillaSaved,
  onPromoCreated,
}: {
  status: StoreSetupStatus;
  storeId: string;
  store: {
    maxStamps?: number;
    name?: string;
    passDesign?: { logoUrl?: string | null } | null;
  } | null;
  cartillaId: string | null;
  onCartillaSaved: (cartilla: any) => void;
  onPromoCreated: (promo: any) => void | Promise<void>;
}) {
  const progressPct = (status.doneCount / 2) * 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          Completa tu negocio
        </h2>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          Antes de abrir el panel, arma tu cartilla de lealtad y al menos una
          promoción. Puedes crear la promo desde la misma cartilla.
        </p>
      </div>

      <div className="onda-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {status.doneCount} de 2 pasos listos
          </p>
          <p className="text-xs text-[var(--onda-muted)]">
            {status.complete ? "Listo para el panel" : "Falta información"}
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--onda-bg)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={status.doneCount}
          aria-label="Progreso de configuración"
        >
          <div
            className="h-full rounded-full bg-[var(--onda-violet)] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2 text-sm">
            <TaskBadge done={status.hasCartilla} />
            Cartilla con al menos una promo
          </li>
          <li className="flex items-center gap-2 text-sm">
            <TaskBadge done={status.hasPromo} />
            {status.hasPromo
              ? `${status.promoCount} ${
                  status.promoCount === 1 ? "promoción" : "promociones"
                }`
              : "Primera promoción"}
          </li>
        </ul>
      </div>

      {cartillaId ? (
        <CartillaEditor
          embedded
          storeId={storeId}
          store={store}
          cartillaId={cartillaId}
          onClose={() => undefined}
          onSaved={onCartillaSaved}
          onPromoCreated={onPromoCreated}
        />
      ) : (
        <SkeletonList rows={3} />
      )}
    </div>
  );
}
