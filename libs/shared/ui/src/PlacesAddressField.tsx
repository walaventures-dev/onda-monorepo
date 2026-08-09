'use client';

import React, { useEffect, useRef, useState } from 'react';

export type PlacesAddressValue = {
  address: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
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
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
          onChangeRef.current({
            address,
            googlePlaceId: place.place_id || undefined,
            lat: loc ? loc.lat() : undefined,
            lng: loc ? loc.lng() : undefined,
          });
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
        onChange={(e) =>
          onChange({
            address: e.target.value,
            googlePlaceId: undefined,
            lat: undefined,
            lng: undefined,
          })
        }
      />
      {apiKey && placesReady ? (
        <span className="onda-field__hint">Sugerencias de Google Places</span>
      ) : !apiKey ? (
        <span className="onda-field__hint">Escribe la dirección completa</span>
      ) : null}
    </div>
  );
}
