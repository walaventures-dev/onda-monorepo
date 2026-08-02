'use client';

import { useMemo } from 'react';
import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
  parseColor,
  type Color,
} from '@heroui/react';

const DEFAULT_PRESETS = [
  '#6E5AE6',
  '#3DB9E8',
  '#5B8AF0',
  '#1A1B2E',
  '#FFFFFF',
  '#E5F6FC',
  '#EEEAFF',
  '#2BB673',
  '#E5484D',
  '#F59E0B',
];

function toHex(value: string | undefined, fallback: string): string {
  const raw = (value || fallback).trim();
  try {
    return parseColor(raw).toString('hex').toUpperCase();
  } catch {
    try {
      return parseColor(fallback).toString('hex').toUpperCase();
    } catch {
      return '#6E5AE6';
    }
  }
}

export type OndaColorPickerProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  /** Valor si el actual no es un color válido */
  fallback?: string;
  presets?: string[];
  className?: string;
  /** Trigger más bajo, ideal para grillas */
  compact?: boolean;
};

/** Selector de color Hero UI (swatch + área + hex) para diseño de pases */
export function OndaColorPicker({
  label,
  value,
  onChange,
  fallback = '#6E5AE6',
  presets = DEFAULT_PRESETS,
  className = '',
  compact = false,
}: OndaColorPickerProps) {
  const hex = useMemo(() => toHex(value, fallback), [value, fallback]);
  const color = useMemo(() => parseColor(hex), [hex]);

  function emit(next: Color) {
    onChange(next.toString('hex').toUpperCase());
  }

  return (
    <div className={`onda-color-field${compact ? ' is-compact' : ''} ${className}`}>
      <ColorPicker value={color} onChange={emit}>
        <ColorPicker.Trigger className="onda-color-trigger">
          <ColorSwatch size={compact ? 'sm' : 'lg'} className="onda-color-swatch" />
          <div className="min-w-0 flex-1 text-left">
            <Label className="block text-[10px] font-medium leading-none text-[var(--onda-muted)]">
              {label}
            </Label>
            <span
              className={`mt-0.5 block font-mono font-semibold tracking-wide text-[var(--onda-ink)] ${
                compact ? 'text-[11px]' : 'text-sm'
              }`}
            >
              {hex}
            </span>
          </div>
        </ColorPicker.Trigger>

        <ColorPicker.Popover className="onda-color-popover gap-3 p-3">
          <ColorSwatchPicker className="justify-start" size="sm">
            {presets.map((preset) => (
              <ColorSwatchPicker.Item key={preset} color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>

          <ColorArea
            aria-label={`${label} · área`}
            className="max-w-full"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorArea.Thumb />
          </ColorArea>

          <ColorSlider
            aria-label={`${label} · tono`}
            channel="hue"
            className="gap-1 px-0.5"
            colorSpace="hsb"
          >
            <Label>Tono</Label>
            <ColorSlider.Output className="text-[var(--onda-muted)]" />
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>

          <ColorField aria-label={`${label} · hex`}>
            <ColorField.Group>
              <ColorField.Prefix>
                <ColorSwatch size="sm" />
              </ColorField.Prefix>
              <ColorField.Input />
            </ColorField.Group>
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>
    </div>
  );
}
