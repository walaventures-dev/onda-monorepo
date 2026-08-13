"use client";

import type { FormEvent } from "react";
import { GradientButton, OndaIcons, toast } from "@onda/shared-ui";
import { PassDesigner } from "./PassDesigner";
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
  design,
  onDesignChange,
  maxStamps,
  onMaxStampsChange,
  milestoneStamps,
  onSaveDesign,
  onCreatePromo,
}: {
  status: StoreSetupStatus;
  design: any;
  onDesignChange: (next: any) => void;
  maxStamps: number;
  onMaxStampsChange: (n: number) => void;
  milestoneStamps: number[];
  onSaveDesign: (e: FormEvent) => Promise<void>;
  onCreatePromo: () => void;
}) {
  const progressPct = (status.doneCount / 2) * 100;

  async function handleSaveDesign(e: FormEvent) {
    e.preventDefault();
    if (!design?.logoUrl?.trim()) {
      toast.danger("Falta el logo", {
        description: "Sube el logo de tu negocio para configurar la tarjeta.",
      });
      return;
    }
    await onSaveDesign(e);
    if (!status.hasPromo) {
      toast.success("Tarjeta guardada", {
        description: "Sigue con tu primera promoción.",
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          Completa tu negocio
        </h2>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          Antes de abrir el panel, define la tarjeta de lealtad (con logo) y al
          menos una promoción.
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
      </div>

      <section className="onda-card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <TaskBadge done={status.hasCard} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold">
              Tarjeta de lealtad
            </h3>
            <p className="text-sm text-[var(--onda-muted)]">
              {status.hasCard
                ? "El logo ya está en tu pase. Puedes ajustar el diseño cuando quieras."
                : "Sube el logo y guarda el diseño. Sin logo la tarjeta no cuenta como configurada."}
            </p>
          </div>
        </div>
        {design ? (
          <PassDesigner
            design={design}
            onChange={onDesignChange}
            maxStamps={maxStamps}
            onMaxStampsChange={onMaxStampsChange}
            milestoneStamps={milestoneStamps}
            onSubmit={handleSaveDesign}
            requireLogo
            saveLabel="Guardar tarjeta"
          />
        ) : (
          <p className="text-sm text-[var(--onda-muted)]">
            Cargando diseño del pase…
          </p>
        )}
      </section>

      <section className="onda-card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <TaskBadge done={status.hasPromo} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold">
              Primera promoción
            </h3>
            <p className="text-sm text-[var(--onda-muted)]">
              {status.hasPromo
                ? `Ya tienes ${status.promoCount} ${
                    status.promoCount === 1 ? "promoción" : "promociones"
                  }.`
                : "Define el beneficio que van a canjear tus clientes."}
            </p>
          </div>
        </div>
        {status.hasPromo ? null : (
          <GradientButton type="button" onClick={onCreatePromo}>
            {OndaIcons.plus}
            Crear promoción
          </GradientButton>
        )}
      </section>
    </div>
  );
}
