'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  api,
  GradientButton,
  OndaDatePicker,
  OndaIcons,
  PlacesAddressField,
  toast,
} from '@onda/shared-ui';
import { normalizeStoreSlug } from '@onda/shared-utils';

type AddressValue = {
  address: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
};

type EditableEvent = {
  id: string;
  name: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  address?: string | null;
  googlePlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
};

type ExistingCartilla = {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  event?: { id: string } | null;
};

type CartillaMode = 'none' | 'new' | 'existing';

export type NewEventModalProps = {
  storeId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (event: { id: string; name: string }) => void;
  /** Cuando se pasa, el modal opera en modo edición (PATCH /events/:id). */
  initialEvent?: EditableEvent | null;
};

function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`onda-field ${className}`}>
      <span className="onda-field__label">{label}</span>
      {children}
      {hint ? <span className="onda-field__hint">{hint}</span> : null}
    </div>
  );
}

function toIso(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Mediodía local para que el día no se desplace al serializar a UTC.
    return new Date(`${date}T12:00:00`).toISOString();
  }
  return date;
}

function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

export function NewEventModal({
  storeId,
  open,
  onClose,
  onCreated,
  initialEvent,
}: NewEventModalProps) {
  const editing = Boolean(initialEvent);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [address, setAddress] = useState<AddressValue>({ address: '' });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cartillaMode, setCartillaMode] = useState<CartillaMode>('new');
  const [existingCartillas, setExistingCartillas] = useState<ExistingCartilla[]>(
    [],
  );
  const [existingCartillaId, setExistingCartillaId] = useState('');
  const [cartillaName, setCartillaName] = useState('');
  const [cartillaTouched, setCartillaTouched] = useState(false);
  const [maxStamps, setMaxStamps] = useState(12);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    void api<{ cartillas: ExistingCartilla[] }>(`/cartillas?storeId=${storeId}`)
      .then((data) => {
        if (cancelled) return;
        const selectable = (data.cartillas || []).filter(
          (c) => !c.isDefault && c.status !== 'ENDED' && !c.event,
        );
        setExistingCartillas(selectable);
        setExistingCartillaId((prev) =>
          selectable.some((c) => c.id === prev) ? prev : (selectable[0]?.id ?? ''),
        );
      })
      .catch(() => {
        if (!cancelled) setExistingCartillas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editing, storeId]);

  useEffect(() => {
    if (!open) return;
    if (initialEvent) {
      setName(initialEvent.name || '');
      setSlug(initialEvent.slug || '');
      setSlugTouched(true);
      setSlugError('');
      setAddress({
        address: initialEvent.address || '',
        googlePlaceId: initialEvent.googlePlaceId || undefined,
        lat: initialEvent.lat ?? undefined,
        lng: initialEvent.lng ?? undefined,
      });
      setStartDate(toDateInput(initialEvent.startDate));
      setEndDate(toDateInput(initialEvent.endDate));
      setCartillaMode('none');
      setCartillaName(`Cartilla — ${initialEvent.name || ''}`);
      setCartillaTouched(false);
      setMaxStamps(12);
    } else {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setSlugError('');
      setAddress({ address: '' });
      setStartDate('');
      setEndDate('');
      setCartillaMode('new');
      setExistingCartillaId('');
      setCartillaName('');
      setCartillaTouched(false);
      setMaxStamps(12);
    }
  }, [open, initialEvent]);

  useEffect(() => {
    if (editing || slugTouched) return;
    setSlug(normalizeStoreSlug(name));
  }, [name, slugTouched, editing]);

  useEffect(() => {
    if (editing || cartillaTouched) return;
    setCartillaName(name.trim() ? `Cartilla — ${name.trim()}` : '');
  }, [name, cartillaTouched, editing]);

  if (!open) return null;

  function close() {
    if (saving) return;
    onClose();
  }

  function validate(): boolean {
    if (!name.trim()) {
      toast.danger('Indica el nombre del evento');
      return false;
    }
    const slugValue = normalizeStoreSlug(slug);
    if (!slugValue) {
      setSlugError('El slug no puede estar vacío');
      toast.danger('El enlace público no puede estar vacío');
      return false;
    }
    if (!startDate || !endDate) {
      toast.danger('Indica las fechas de inicio y fin');
      return false;
    }
    if (endDate < startDate) {
      toast.danger('La fecha de fin no puede ser anterior al inicio');
      return false;
    }
    return true;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing && initialEvent) {
        const updated = await api<{ id: string; name: string }>(
          `/events/${initialEvent.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: name.trim(),
              startDate: toIso(startDate),
              endDate: toIso(endDate),
              ...(address.address
                ? {
                    address: address.address,
                    ...(address.googlePlaceId
                      ? { googlePlaceId: address.googlePlaceId }
                      : {}),
                    ...(address.lat != null ? { lat: address.lat } : {}),
                    ...(address.lng != null ? { lng: address.lng } : {}),
                  }
                : {}),
            }),
          },
        );
        toast.success('Evento actualizado');
        onCreated?.(updated);
        onClose();
        return;
      }

      const event = await api<{ id: string; name: string }>('/events', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: normalizeStoreSlug(slug),
          startDate: toIso(startDate),
          endDate: toIso(endDate),
          ownerStoreId: storeId,
          ...(address.address
            ? {
                address: address.address,
                ...(address.googlePlaceId
                  ? { googlePlaceId: address.googlePlaceId }
                  : {}),
                ...(address.lat != null ? { lat: address.lat } : {}),
                ...(address.lng != null ? { lng: address.lng } : {}),
              }
            : {}),
        }),
      });

      if (cartillaMode === 'new') {
        await api('/cartillas', {
          method: 'POST',
          body: JSON.stringify({
            storeId,
            name: cartillaName.trim() || `Cartilla — ${name.trim()}`,
            eventId: event.id,
            startsAt: toIso(startDate),
            endsAt: toIso(endDate),
            maxStamps,
          }),
        });
        toast.success('Evento y cartilla creados');
      } else if (cartillaMode === 'existing' && existingCartillaId) {
        await api(`/cartillas/${existingCartillaId}`, {
          method: 'PATCH',
          body: JSON.stringify({ eventId: event.id }),
        });
        toast.success('Evento creado y cartilla vinculada');
      } else {
        toast.success('Evento creado');
      }
      onCreated?.(event);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      setSlugError(message);
      toast.danger(editing ? 'No se pudo actualizar el evento' : 'No se pudo crear el evento', {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="onda-dialog-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-event-modal-title"
        className="onda-dialog w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onda-dialog-header">
          <div className="min-w-0 flex-1">
            <h2 id="new-event-modal-title" className="onda-dialog-title">
              {editing ? 'Editar evento' : 'Nuevo evento'}
            </h2>
            <p className="onda-dialog-body mt-1 !mb-0">
              {editing
                ? 'Actualiza los datos de tu evento o feria.'
                : 'Registra tu propio evento o feria y crea su cartilla de sellos.'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
            onClick={close}
          >
            {OndaIcons.close} Cerrar
          </button>
        </header>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Nombre del evento o feria">
            <input
              required
              className="onda-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Feria del Café"
            />
          </Field>

          <Field
            label="Enlace público (slug)"
            hint={
              slugError ||
              (editing
                ? 'El slug no se puede cambiar después de crear el evento.'
                : 'Enlace público del evento (ej. /e/feria-cafe)')
            }
          >
            <input
              required
              className={`onda-input ${slugError ? '!border-[var(--onda-danger)]' : ''}`}
              value={slug}
              disabled={editing}
              onChange={(e) => {
                setSlugTouched(true);
                setSlugError('');
                setSlug(normalizeStoreSlug(e.target.value));
              }}
              placeholder="feria-cafe"
            />
          </Field>

          <PlacesAddressField
            label="Dirección del evento (opcional)"
            value={address.address}
            onChange={(next) => {
              setAddress({
                address: next.address,
                googlePlaceId: next.googlePlaceId,
                lat: next.lat,
                lng: next.lng,
              });
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <OndaDatePicker
              label="Fecha de inicio"
              value={startDate}
              onChange={setStartDate}
              isRequired
            />
            <OndaDatePicker
              label="Fecha de fin"
              value={endDate}
              onChange={setEndDate}
              isRequired
            />
          </div>

          {!editing ? (
            <div className="space-y-3 rounded-2xl border border-[var(--onda-border)] p-3">
              <span className="onda-field__label">Cartilla del evento</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--onda-ink)]">
                  <input
                    type="radio"
                    name="cartilla-mode"
                    className="accent-[var(--onda-violet)]"
                    checked={cartillaMode === 'new'}
                    onChange={() => setCartillaMode('new')}
                  />
                  Crear una cartilla nueva
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--onda-ink)]">
                  <input
                    type="radio"
                    name="cartilla-mode"
                    className="accent-[var(--onda-violet)]"
                    checked={cartillaMode === 'existing'}
                    onChange={() => setCartillaMode('existing')}
                    disabled={!existingCartillas.length}
                  />
                  Usar una cartilla existente
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--onda-ink)]">
                  <input
                    type="radio"
                    name="cartilla-mode"
                    className="accent-[var(--onda-violet)]"
                    checked={cartillaMode === 'none'}
                    onChange={() => setCartillaMode('none')}
                  />
                  Sin cartilla
                </label>
              </div>

              {cartillaMode === 'existing' ? (
                existingCartillas.length ? (
                  <Field
                    label="Cartilla"
                    hint="Se vincula al evento y hereda sus fechas si no tiene."
                  >
                    <select
                      className="onda-input w-full"
                      value={existingCartillaId}
                      onChange={(e) => setExistingCartillaId(e.target.value)}
                    >
                      {existingCartillas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.endsAt ? ` (hasta ${String(c.endsAt).slice(0, 10)})` : ' (sin vencimiento)'}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <p className="text-xs text-[var(--onda-muted)]">
                    No tienes cartillas disponibles para vincular (las base, las
                    finalizadas y las ya ligadas a otro evento no aparecen).
                  </p>
                )
              ) : null}

              {cartillaMode === 'new' ? (
                <div className="space-y-3">
                  <Field label="Nombre de la cartilla">
                    <input
                      className="onda-input"
                      value={cartillaName}
                      onChange={(e) => {
                        setCartillaTouched(true);
                        setCartillaName(e.target.value);
                      }}
                      placeholder="Cartilla — Feria del Café"
                    />
                  </Field>
                  <Field label="Sellos para completar">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="onda-input w-32"
                      value={maxStamps}
                      onChange={(e) =>
                        setMaxStamps(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
              disabled={saving}
              onClick={close}
            >
              Cancelar
            </button>
            <GradientButton type="submit" disabled={saving} className="min-w-[10rem]">
              {saving
                ? 'Guardando…'
                : editing
                  ? 'Guardar cambios'
                  : 'Crear evento'}
            </GradientButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewEventModal;
