'use client';

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ImageUploadField } from './ImageUploadField';
import { OndaSelect } from './OndaSelect';
import { PlacesAddressField } from './PlacesAddressField';

function GradientButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`onda-gradient inline-flex items-center justify-center gap-1.5 rounded-full border-0 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
import {
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
  STORE_SUBCATEGORIES_BY_CATEGORY,
  STORE_SEGMENTS_BY_SUBCATEGORY,
  STORE_SEGMENT_LABELS,
  defaultSegmentFor,
} from '@onda/shared-types';
import { normalizeStoreSlug } from '@onda/shared-utils';

export type StoreProfileFormValues = {
  name: string;
  logoUrl: string;
  category: StoreCategory;
  subcategory: StoreSubcategory;
  segment: StoreSegment;
  slug: string;
  address: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
};

const CATEGORY_OPTIONS = (
  Object.keys(STORE_CATEGORY_LABELS) as StoreCategory[]
).map((id) => ({ id, label: STORE_CATEGORY_LABELS[id] }));

export function StoreProfileForm({
  initial,
  busy,
  error,
  submitLabel,
  onSubmit,
}: {
  initial: StoreProfileFormValues;
  busy?: boolean;
  error?: string;
  submitLabel: string;
  onSubmit: (values: StoreProfileFormValues) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [category, setCategory] = useState(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [segment, setSegment] = useState(initial.segment);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState(initial.address);
  const [googlePlaceId, setGooglePlaceId] = useState(initial.googlePlaceId);
  const [lat, setLat] = useState(initial.lat);
  const [lng, setLng] = useState(initial.lng);

  useEffect(() => {
    setName(initial.name);
    setLogoUrl(initial.logoUrl);
    setCategory(initial.category);
    setSubcategory(initial.subcategory);
    setSegment(initial.segment);
    setSlug(initial.slug);
    setSlugTouched(false);
    setAddress(initial.address);
    setGooglePlaceId(initial.googlePlaceId);
    setLat(initial.lat);
    setLng(initial.lng);
  }, [initial]);

  const subcategoryOptions = useMemo(
    () =>
      (STORE_SUBCATEGORIES_BY_CATEGORY[category] || []).map((id) => ({
        id,
        label: STORE_SUBCATEGORY_LABELS[id],
      })),
    [category]
  );

  const segmentOptions = useMemo(
    () =>
      (STORE_SEGMENTS_BY_SUBCATEGORY[subcategory] || []).map((id) => ({
        id,
        label: STORE_SEGMENT_LABELS[id],
      })),
    [subcategory]
  );

  useEffect(() => {
    const subs = STORE_SUBCATEGORIES_BY_CATEGORY[category];
    if (!subs?.length) return;
    if (!subs.includes(subcategory)) {
      const next = subs[0];
      setSubcategory(next);
      setSegment(defaultSegmentFor(next));
    }
  }, [category, subcategory]);

  useEffect(() => {
    const segs = STORE_SEGMENTS_BY_SUBCATEGORY[subcategory];
    if (!segs?.length) return;
    if (!segs.includes(segment)) {
      setSegment(defaultSegmentFor(subcategory));
    }
  }, [subcategory, segment]);

  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(normalizeStoreSlug(name));
    }
  }, [name, slugTouched]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void onSubmit({
      name,
      logoUrl,
      category,
      subcategory,
      segment,
      slug,
      address,
      googlePlaceId,
      lat,
      lng,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Nombre del negocio *</span>
        <input
          className="onda-input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <ImageUploadField
        label="Logo (opcional)"
        hint="JPG, PNG o WEBP"
        aspectClass="aspect-square"
        variant="logo"
        value={logoUrl}
        onChange={setLogoUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Tipo de negocio *</span>
          <OndaSelect
            aria-label="Tipo de negocio"
            value={category}
            onChange={(v) => setCategory(v as StoreCategory)}
            options={CATEGORY_OPTIONS}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Categoría</span>
          <OndaSelect
            aria-label="Categoría"
            value={subcategory}
            onChange={(v) => setSubcategory(v as StoreSubcategory)}
            options={subcategoryOptions}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Subcategoría</span>
          <OndaSelect
            aria-label="Subcategoría"
            value={segment}
            onChange={(v) => setSegment(v as StoreSegment)}
            options={segmentOptions}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Slug público</span>
          <input
            className="onda-input w-full"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(normalizeStoreSlug(e.target.value));
            }}
          />
        </label>
      </div>

      {category !== StoreCategory.BRAND ? (
        <PlacesAddressField
          value={address}
          onChange={(next) => {
            setAddress(next.address);
            setGooglePlaceId(next.googlePlaceId);
            setLat(next.lat);
            setLng(next.lng);
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}

      <GradientButton type="submit" disabled={busy}>
        {busy ? 'Guardando…' : submitLabel}
      </GradientButton>
    </form>
  );
}
