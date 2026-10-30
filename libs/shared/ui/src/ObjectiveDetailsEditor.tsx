'use client';

import {
  OBJECTIVE_DETAIL_FIELDS,
  OBJECTIVE_TITLES,
  clampObjectiveDetail,
  type ObjectiveDetailFieldKey,
  type ObjectiveDetails,
  type ObjectiveKind,
} from '@onda/shared-utils';

const DETAIL_INPUT =
  'w-full rounded-xl border border-[var(--onda-border)] bg-white px-3 py-1.5 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]';

export type ObjectiveDetailsEditorProps = {
  kind: ObjectiveKind;
  details: ObjectiveDetails;
  onChange: (patch: Partial<ObjectiveDetails>) => void;
  className?: string;
};

export function ObjectiveDetailsEditor({
  kind,
  details,
  onChange,
  className = '',
}: ObjectiveDetailsEditorProps) {
  const fields = OBJECTIVE_DETAIL_FIELDS[kind];

  return (
    <div
      className={`mt-4 rounded-2xl border border-[var(--onda-border)] bg-white p-3 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-[var(--onda-ink)]">
          Parámetros · {OBJECTIVE_TITLES[kind]}
        </p>
        <p className="text-[10px] text-[var(--onda-muted)]">
          Recomendado · editable
        </p>
      </div>

      <div className="mt-2 divide-y divide-[var(--onda-border)]">
        {fields.map((field) => {
          if (field.type === 'boolean') {
            const checked = Boolean(details[field.key]);
            return (
              <label
                key={field.key}
                className="flex cursor-pointer items-center justify-between gap-3 px-1 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--onda-ink)]">
                    {field.label}
                  </span>
                  {field.hint ? (
                    <span className="mt-0.5 block text-[10px] text-[var(--onda-muted)]">
                      {field.hint}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onChange({
                      [field.key]: clampObjectiveDetail(
                        field.key,
                        e.target.checked
                      ),
                    } as Partial<ObjectiveDetails>)
                  }
                  className="h-4 w-4 shrink-0 rounded border-[var(--onda-border)] accent-[var(--onda-primary-500)]"
                />
              </label>
            );
          }

          const value = details[field.key];
          return (
            <label
              key={field.key}
              className="flex items-center gap-3 px-1 py-2"
            >
              <span className="w-36 shrink-0 text-xs font-medium text-[var(--onda-muted)]">
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
                    [key]: clampObjectiveDetail(
                      key,
                      field.type === 'number'
                        ? e.target.value
                        : e.target.value
                    ),
                  } as Partial<ObjectiveDetails>);
                }}
                className={DETAIL_INPUT}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
