'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, OndaIcons } from '@onda/shared-ui';
import { PencilIcon as Pencil } from '@phosphor-icons/react/dist/csr/Pencil';

export type NameOption = { id: string; label: string; icon: ReactNode };

const OTHER_ID = '__other__';

/**
 * Modal para crear algo con nombre: ofrece opciones predefinidas (con icono)
 * o un nombre personalizado vía la opción "Otro".
 */
export function NamePickerModal({
  title,
  description,
  options,
  otherPlaceholder = 'Nombre personalizado',
  submitLabel = 'Crear',
  busy = false,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: string;
  options: NameOption[];
  otherPlaceholder?: string;
  submitLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<string | null>(options[0]?.id ?? null);
  const [custom, setCustom] = useState('');
  const isOther = selected === OTHER_ID;
  const selectedOption = options.find((o) => o.id === selected);
  const canSubmit = !busy && (Boolean(selectedOption) || custom.trim().length > 0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = (selectedOption?.label ?? custom).trim();
    if (!name) return;
    await onSubmit(name);
  }

  const optionClass = (active: boolean) =>
    `flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition ${
      active
        ? 'border-[var(--onda-bridge)] bg-[var(--onda-bridge)]/10 text-[var(--onda-ink)] ring-1 ring-[var(--onda-bridge)]'
        : 'border-[var(--onda-border)] bg-[var(--onda-card)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)]/60 hover:text-[var(--onda-ink)]'
    }`;

  return (
    <div
      className="onda-dialog-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-picker-title"
        className="onda-dialog w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onda-dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id="name-picker-title" className="onda-dialog-title">
              {title}
            </h2>
            {description ? (
              <p className="onda-dialog-body mt-1 !mb-0">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
            onClick={onClose}
          >
            {OndaIcons.close} Cerrar
          </button>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="listbox" aria-label={title}>
            {options.map((opt) => (
              <button
                type="button"
                key={opt.id}
                role="option"
                aria-selected={selected === opt.id}
                onClick={() => setSelected(opt.id)}
                className={optionClass(selected === opt.id)}
              >
                {opt.icon}
                <span className="text-center leading-tight">{opt.label}</span>
              </button>
            ))}
            <button
              type="button"
              role="option"
              aria-selected={isOther}
              onClick={() => setSelected(OTHER_ID)}
              className={optionClass(isOther)}
            >
              <Pencil className="h-5 w-5" weight="regular" aria-hidden />
              <span className="text-center leading-tight">Otro</span>
            </button>
          </div>
          {isOther ? (
            <input
              autoFocus
              className="onda-input w-full"
              placeholder={otherPlaceholder}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={40}
            />
          ) : null}
          <div className="onda-dialog-footer flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="onda-dialog-btn inline-flex items-center gap-1"
              onClick={onClose}
            >
              {OndaIcons.close} Cancelar
            </button>
            <Button type="submit" isDisabled={!canSubmit}>
              {busy ? 'Guardando…' : <>{OndaIcons.plus} {submitLabel}</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
