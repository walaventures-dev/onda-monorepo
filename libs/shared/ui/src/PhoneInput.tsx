'use client';

import React from 'react';
import { formatPhoneMask, isCompletePhoneMask, toE164Colombia } from '@onda/shared-utils';

export type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: string;
  /** Valor enmascarado (xxx) xxx - xxxx */
  onChange: (masked: string) => void;
  /** Emite también E.164 (+57…) cuando el número está completo */
  onE164Change?: (e164: string) => void;
};

export function PhoneInput({
  value,
  onChange,
  onE164Change,
  className = '',
  placeholder = '(300) 000 - 0000',
  ...rest
}: PhoneInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = formatPhoneMask(e.target.value);
    onChange(masked);
    if (onE164Change) {
      onE164Change(isCompletePhoneMask(masked) ? toE164Colombia(masked) : '');
    }
  }

  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      maxLength={16}
      className={
        className ||
        'w-full rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-3 text-[var(--onda-ink)] outline-none focus:border-[var(--onda-violet)]'
      }
      aria-invalid={value.length > 0 && !isCompletePhoneMask(value) ? true : undefined}
    />
  );
}
