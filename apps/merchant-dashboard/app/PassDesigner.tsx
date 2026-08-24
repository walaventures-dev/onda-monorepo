"use client";

import type { FormEvent } from "react";
import {
  GradientButton,
  ImageUploadField,
  OndaColorPicker,
  PassPreview,
  OndaIcons,
} from "@onda/shared-ui";
import { derivePassPalette } from "@onda/shared-utils";

export function PassDesigner({
  design,
  onChange,
  maxStamps,
  onMaxStampsChange,
  milestoneStamps,
  onSubmit,
  requireLogo = false,
  saveLabel = "Guardar preview",
  lockCycle = false,
  readOnly = false,
  deadlineLabel,
}: {
  design: any;
  onChange: (next: any) => void;
  maxStamps: number;
  onMaxStampsChange: (n: number) => void;
  milestoneStamps: number[];
  onSubmit: (e: FormEvent) => void | Promise<void>;
  requireLogo?: boolean;
  saveLabel?: string;
  lockCycle?: boolean;
  readOnly?: boolean;
  deadlineLabel?: string | null;
}) {
  return (
    <div className="onda-pass-designer-layout">
      <form
        onSubmit={(e) => {
          if (readOnly) {
            e.preventDefault();
            return;
          }
          onSubmit(e);
        }}
        className={`onda-card onda-pass-designer p-6${readOnly ? " pointer-events-none opacity-70" : ""}`}
      >
        <div className="onda-pass-designer-brand">
          <ImageUploadField
            label="Logo"
            hint={
              requireLogo
                ? "Obligatorio. JPG, PNG o WEBP · esquinas redondeadas"
                : "JPG, PNG o WEBP · esquinas redondeadas"
            }
            aspectClass="aspect-square"
            className="onda-pass-designer-logo"
            variant="logo"
            value={design.logoUrl || ""}
            onChange={(logoUrl) => onChange({ ...design, logoUrl })}
          />
          <div className="onda-pass-designer-brand-color">
            <OndaColorPicker
              label="Color de marca"
              value={design.backgroundColor || "#6E5AE6"}
              fallback="#6E5AE6"
              onChange={(backgroundColor) =>
                onChange({
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

        <ImageUploadField
          label="Banner (opcional)"
          hint="Horizontal · JPG, PNG o WEBP · se muestra arriba de los sellos"
          aspectClass="aspect-[3/1]"
          className="onda-pass-designer-banner"
          value={design.stripImageUrl || ""}
          onChange={(stripImageUrl) => onChange({ ...design, stripImageUrl })}
        />

        <div className="onda-pass-designer-fields">
          <div className="onda-pass-designer-row">
            <label>
              <span>Título</span>
              <input
                value={design.title || ""}
                onChange={(e) =>
                  onChange({ ...design, title: e.target.value })
                }
              />
            </label>
            <label>
              <span>Subtítulo</span>
              <input
                value={design.subtitle || ""}
                onChange={(e) =>
                  onChange({
                    ...design,
                    subtitle: e.target.value,
                  })
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
                onChange({
                  ...design,
                  description: e.target.value,
                })
              }
            />
          </label>

          {!lockCycle ? (
          <label>
            <span>Número de sellos del ciclo</span>
            <input
              type="number"
              min={1}
              max={12}
              required
              value={maxStamps}
              onChange={(e) => onMaxStampsChange(Number(e.target.value))}
            />
          </label>
          ) : null}

          {readOnly ? null : (
          <div className="flex justify-end pt-1">
            <GradientButton type="submit">
              {OndaIcons.save}
              {saveLabel}
            </GradientButton>
          </div>
          )}
        </div>
      </form>

      <div className="onda-pass-designer-preview">
        <p className="onda-pass-designer-label mb-3">Vista previa</p>
        <PassPreview
          {...design}
          points={Math.min(3, maxStamps)}
          maxStamps={maxStamps}
          milestoneStamps={milestoneStamps}
          memberName="Cliente demo"
          deadlineLabel={deadlineLabel}
        />
      </div>
    </div>
  );
}
