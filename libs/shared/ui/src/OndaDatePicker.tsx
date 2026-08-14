'use client';

import { parseDate, type DateValue } from '@internationalized/date';
import {
  Calendar,
  DateField,
  DatePicker,
  Label,
} from '@heroui/react';
import { I18nProvider } from '@heroui/react/rac';

export type OndaDatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  'aria-label'?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  compact?: boolean;
  className?: string;
};

function fromIso(iso: string): DateValue | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

function toIso(value: DateValue | null): string {
  if (!value) return '';
  const y = String(value.year).padStart(4, '0');
  const m = String(value.month).padStart(2, '0');
  const d = String(value.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function OndaDatePicker({
  value,
  onChange,
  label,
  'aria-label': ariaLabel,
  isRequired,
  isDisabled,
  compact = false,
  className = '',
}: OndaDatePickerProps) {
  const parsed = fromIso(value);
  const name = ariaLabel || label || 'Fecha';

  return (
    <I18nProvider locale="es-CO">
      <DatePicker
        className={`onda-date-picker ${compact ? 'onda-date-picker--compact' : ''} ${className}`}
        value={parsed}
        onChange={(next) => onChange(toIso(next))}
        isRequired={isRequired}
        isDisabled={isDisabled}
        granularity="day"
        aria-label={label ? undefined : name}
      >
        {label ? <Label className="onda-date-picker-label">{label}</Label> : null}
        <DateField.Group fullWidth className="onda-date-field">
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger className="onda-date-picker-trigger">
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover className="onda-date-popover">
          <Calendar aria-label={name}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
}
