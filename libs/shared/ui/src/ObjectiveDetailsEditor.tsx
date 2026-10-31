'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { SparkleIcon as Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import {
  OBJECTIVE_DETAIL_FIELDS,
  OBJECTIVE_TITLES,
  SLOW_DOW_SHORT,
  clampObjectiveDetail,
  formatSlowHour,
  type ObjectiveDetailFieldKey,
  type ObjectiveDetails,
  type ObjectiveKind,
} from '@onda/shared-utils';

const CHIP = 'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition';
const INPUT =
  'w-16 rounded-full border border-[var(--onda-border)] bg-white px-2 py-1 text-center text-xs text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]';

const INPUT_TEXT =
  'w-40 rounded-full border border-[var(--onda-border)] bg-white px-3 py-1 text-xs text-[var(--onda-ink)] outline-none placeholder:text-[var(--onda-muted)] focus:border-[var(--onda-bridge)]';

export type ObjectiveDetailsEditorProps = {
  kind: ObjectiveKind;
  details: ObjectiveDetails;
  onChange: (patch: Partial<ObjectiveDetails>) => void;
  className?: string;
  /** Calcula y aplica una propuesta de parámetros basada en datos reales. */
  onPropose?: () => void;
  proposeLoading?: boolean;
};

export function ObjectiveDetailsEditor({
  kind,
  details,
  onChange,
  className = '',
  onPropose,
  proposeLoading = false,
}: ObjectiveDetailsEditorProps) {
  const fields = OBJECTIVE_DETAIL_FIELDS[kind];

  return (
    <div
      className={`mt-4 rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2.5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--onda-muted)]">
          {OBJECTIVE_TITLES[kind]}
        </p>

        {onPropose ? (
          <button
            type="button"
            onClick={onPropose}
            disabled={proposeLoading}
            className="flex items-center gap-1 rounded-full bg-[var(--onda-primary-500)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Sparkle
              className={`h-3 w-3 ${proposeLoading ? 'animate-pulse' : ''}`}
              weight="fill"
              aria-hidden
            />
            {proposeLoading ? 'Analizando…' : 'Proponer'}
          </button>
        ) : null}

        {fields.map((field) => {
          if (field.type === 'boolean') {
            return (
              <label
                key={field.key}
                className="flex cursor-pointer items-center gap-1.5"
                title={field.hint}
              >
                <span className="text-[11px] font-medium text-[var(--onda-muted)]">
                  {field.label}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(details[field.key])}
                  onChange={(e) =>
                    onChange({
                      [field.key]: clampObjectiveDetail(
                        field.key,
                        e.target.checked
                      ),
                    } as Partial<ObjectiveDetails>)
                  }
                  className="h-3.5 w-3.5 rounded border-[var(--onda-border)] accent-[var(--onda-primary-500)]"
                />
              </label>
            );
          }

          if (field.type === 'weekdays') {
            const selected = new Set(
              Array.isArray(details[field.key])
                ? (details[field.key] as number[])
                : []
            );
            return (
              <div key={field.key} className="flex items-center gap-1.5" title={field.hint}>
                <span className="text-[11px] font-medium text-[var(--onda-muted)]">
                  {field.label}
                </span>
                <div className="flex gap-1">
                  {SLOW_DOW_SHORT.map((label, i) => {
                    const dow = i + 1;
                    const active = selected.has(dow);
                    return (
                      <button
                        key={dow}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const next = active
                            ? [...selected].filter((d) => d !== dow)
                            : [...selected, dow];
                          onChange({
                            [field.key]: clampObjectiveDetail(field.key, next),
                          } as Partial<ObjectiveDetails>);
                        }}
                        className={`${CHIP} ${
                          active
                            ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-500)] text-white'
                            : 'border-[var(--onda-border)] bg-white text-[var(--onda-muted)] hover:border-[var(--onda-bridge)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (field.type === 'hours') {
            const value = Number(details[field.key]);
            return (
              <div key={field.key} className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--onda-muted)]">
                  {field.label}
                </span>
                <HourDropdown
                  value={Number.isFinite(value) ? value : (field.min ?? 5)}
                  min={field.min ?? 5}
                  max={field.max ?? 23}
                  onChange={(h) =>
                    onChange({
                      [field.key]: clampObjectiveDetail(field.key, h),
                    } as Partial<ObjectiveDetails>)
                  }
                />
              </div>
            );
          }

          const value = details[field.key];
          return (
            <label key={field.key} className="flex items-center gap-1.5" title={field.hint}>
              <span className="text-[11px] font-medium text-[var(--onda-muted)]">
                {field.label}
              </span>
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                min={field.min}
                max={field.max}
                value={String(value ?? '')}
                placeholder={field.placeholder}
                onChange={(e) => {
                  const key = field.key as ObjectiveDetailFieldKey;
                  onChange({
                    [key]: clampObjectiveDetail(key, e.target.value),
                  } as Partial<ObjectiveDetails>);
                }}
                className={field.type === 'number' ? INPUT : INPUT_TEXT}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function HourDropdown({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (hour: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-[4.5rem] items-center justify-between gap-1 rounded-full border border-[var(--onda-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
      >
        {formatSlowHour(value)}
        <CaretDown
          className={`h-3 w-3 text-[var(--onda-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          weight="bold"
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-44 w-full min-w-[4.5rem] overflow-auto rounded-xl border border-[var(--onda-border)] bg-white py-1 shadow-lg"
        >
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
            <li key={h} role="option" aria-selected={h === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(h);
                  setOpen(false);
                }}
                className={`block w-full px-2.5 py-1 text-left text-xs ${
                  h === value
                    ? 'bg-[var(--onda-primary-50)] font-semibold text-[var(--onda-primary-700)]'
                    : 'text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]'
                }`}
              >
                {formatSlowHour(h)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
