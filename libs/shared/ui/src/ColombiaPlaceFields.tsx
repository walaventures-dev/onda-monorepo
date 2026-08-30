'use client';

import { useId, useState } from 'react';
import {
  COLOMBIA_DEPARTMENTS,
  filterMunicipalities,
  matchColombiaMunicipality,
  municipalitiesOf,
} from '@onda/shared-utils';
import { OndaSelect } from './OndaSelect';

const DEPT_OPTIONS = COLOMBIA_DEPARTMENTS.map((d) => ({
  id: d.name,
  label: d.name,
}));

export type ColombiaPlaceFieldsProps = {
  department: string;
  municipality: string;
  onDepartmentChange: (department: string) => void;
  onMunicipalityChange: (municipality: string) => void;
  labelClassName?: string;
  inputClassName?: string;
};

export function ColombiaPlaceFields({
  department,
  municipality,
  onDepartmentChange,
  onMunicipalityChange,
  labelClassName = 'onda-field__label',
  inputClassName = '',
}: ColombiaPlaceFieldsProps) {
  const listId = useId();
  const deptLabelId = useId();
  const muniLabelId = useId();
  const [query, setQuery] = useState(municipality);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const enabled = Boolean(department);
  const options = enabled ? filterMunicipalities(department, query) : [];
  const activeId = options[active] ? `${listId}-${active}` : undefined;

  function pickDepartment(next: string) {
    onDepartmentChange(next);
    const munis = municipalitiesOf(next);
    const only = munis.length === 1 ? munis[0] : '';
    onMunicipalityChange(only);
    setQuery(only);
    setOpen(false);
    setActive(0);
  }

  function pickMunicipality(name: string) {
    onMunicipalityChange(name);
    setQuery(name);
    setOpen(false);
  }

  function onMunicipalityBlur() {
    const matched = matchColombiaMunicipality(department, query);
    if (matched) {
      pickMunicipality(matched);
      return;
    }
    setQuery(municipality);
    setOpen(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="onda-field">
        <span className={labelClassName} id={deptLabelId}>
          Departamento
        </span>
        <OndaSelect
          value={department}
          onChange={pickDepartment}
          options={DEPT_OPTIONS}
          placeholder="Seleccionar…"
          aria-label="Departamento"
        />
      </div>

      <div className="onda-field">
        <span className={labelClassName} id={muniLabelId}>
          Municipio
        </span>
        <div className="relative">
          <input
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-50`}
            role="combobox"
            aria-labelledby={muniLabelId}
            aria-autocomplete="list"
            aria-expanded={open && enabled}
            aria-controls={listId}
            aria-activedescendant={open ? activeId : undefined}
            autoComplete="address-level2"
            disabled={!enabled}
            placeholder={
              enabled ? 'Escribe para buscar…' : 'Primero elige el departamento'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (municipality) onMunicipalityChange('');
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => enabled && setOpen(true)}
            onBlur={onMunicipalityBlur}
            onKeyDown={(e) => {
              if (!enabled) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                if (open) {
                  e.preventDefault();
                  if (options[active]) pickMunicipality(options[active]);
                }
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          {open && enabled ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[1rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-1 shadow-[0_16px_40px_rgba(26,27,46,0.12)]"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--onda-muted)]">
                  Sin municipios con ese nombre
                </li>
              ) : (
                options.map((name, i) => (
                  <li
                    key={name}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pickMunicipality(name)}
                    className={`cursor-pointer rounded-full px-3 py-2 text-sm ${
                      i === active
                        ? 'bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]'
                        : 'text-[var(--onda-ink)]'
                    }`}
                  >
                    {name}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
