'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';

export type PlacesAddressValue = {
  address: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  googleRating?: number | null;
  googleReviewCount?: number | null;
};

export type PlacesAddressFieldProps = {
  value: string;
  onChange: (next: PlacesAddressValue) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Oculta el label interno (cuando el padre ya muestra uno). */
  hideLabel?: boolean;
};

declare global {
  interface Window {
    google?: any;
    __ondaPlacesReady?: Promise<void>;
  }
}

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__ondaPlacesReady) return window.__ondaPlacesReady;

  window.__ondaPlacesReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=es`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Places'));
    document.head.appendChild(script);
  });

  return window.__ondaPlacesReady;
}

/** Dirección con autocomplete de Google Places; sin API key funciona como texto libre. */
export function PlacesAddressField({
  value,
  onChange,
  label = 'Dirección',
  placeholder = 'Busca la dirección del negocio…',
  className = '',
  hideLabel = false,
}: PlacesAddressFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [placesReady, setPlacesReady] = useState(false);
  const [preview, setPreview] = useState<{
    rating: number | null;
    reviewCount: number | null;
    mapsUrl: string;
  } | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  async function loadPreview(placeId: string, base: PlacesAddressValue) {
    try {
      const data = await api<{
        rating: number | null;
        reviewCount: number | null;
        mapsUrl: string;
      }>(`/places/${encodeURIComponent(placeId)}/preview`);
      setPreview(data);
      onChangeRef.current({
        ...base,
        googleRating: data.rating,
        googleReviewCount: data.reviewCount,
      });
    } catch {
      setPreview(null);
      onChangeRef.current(base);
    }
  }

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadGooglePlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: ['formatted_address', 'place_id', 'geometry'],
            componentRestrictions: { country: ['co'] },
          }
        );
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const address =
            place.formatted_address || inputRef.current?.value || '';
          const loc = place.geometry?.location;
          const base: PlacesAddressValue = {
            address,
            googlePlaceId: place.place_id || undefined,
            lat: loc ? loc.lat() : undefined,
            lng: loc ? loc.lng() : undefined,
          };
          if (place.place_id) {
            void loadPreview(place.place_id, base);
          } else {
            setPreview(null);
            onChangeRef.current(base);
          }
        });
        setPlacesReady(true);
      })
      .catch(() => {
        /* fallback texto libre */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <div className={`onda-field ${className}`}>
      {!hideLabel ? <span className="onda-field__label">{label}</span> : null}
      <input
        ref={inputRef}
        className="onda-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setPreview(null);
          onChange({
            address: e.target.value,
            googlePlaceId: undefined,
            lat: undefined,
            lng: undefined,
            googleRating: undefined,
            googleReviewCount: undefined,
          });
        }}
      />
      {apiKey && placesReady ? (
        <span className="onda-field__hint">Sugerencias de Google Places</span>
      ) : !apiKey ? (
        <span className="onda-field__hint">Escribe la dirección completa</span>
      ) : null}
      {preview && preview.rating != null ? (
        <div className="mt-3 rounded-xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
            Así te ven hoy en Google
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-[var(--onda-ink)]">
              ★ {preview.rating.toFixed(1)}
            </span>
            {preview.reviewCount != null ? (
              <span className="text-sm text-[var(--onda-muted)]">
                {preview.reviewCount.toLocaleString('es-CO')} reseñas
              </span>
            ) : null}
            {preview.mapsUrl ? (
              <a
                href={preview.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--onda-violet)] hover:underline"
              >
                Ver en Maps
              </a>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[var(--onda-muted)]">
            Onda te ayudará a mejorar esto con feedback de tus clientes.
          </p>
        </div>
      ) : null}
    </div>
  );
}
