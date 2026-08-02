'use client';

import { ListBox, Select } from '@heroui/react';

export type OndaSelectOption = {
  id: string;
  label: string;
};

export type OndaSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: OndaSelectOption[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  isDisabled?: boolean;
};

/** Dropdown Hero UI (no nativo) — trigger pill + popover con check */
export function OndaSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  className = '',
  'aria-label': ariaLabel = 'Seleccionar',
  isDisabled,
}: OndaSelectProps) {
  return (
    <Select
      aria-label={ariaLabel}
      className={`onda-select min-w-[300px] w-[min(100%,22rem)] ${className}`}
      placeholder={placeholder}
      selectedKey={value || null}
      isDisabled={isDisabled}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
    >
      <Select.Trigger className="onda-select-trigger">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="onda-select-popover">
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
              {opt.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
