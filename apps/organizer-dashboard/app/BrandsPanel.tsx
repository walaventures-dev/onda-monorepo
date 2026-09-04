'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  GradientButton,
  StoreProfileForm,
  type StoreProfileFormValues,
  api,
  OndaIcons,
} from '@onda/shared-ui';
import {
  StoreCategory,
  StoreSubcategory,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
} from '@onda/shared-types';
import { useOrganizerAuth } from '../lib/organizerAuth';

type DraftRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string;
  segment: string;
  address: string | null;
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  claimUrl: string | null;
  logoUrl: string | null;
};

function toFormValues(d: Partial<DraftRow>): StoreProfileFormValues {
  return {
    name: d.name || '',
    logoUrl: d.logoUrl || '',
    category: (d.category as StoreCategory) || StoreCategory.BRAND,
    subcategory:
      (d.subcategory as StoreSubcategory) || StoreSubcategory.BEVERAGE,
    segment: (d.segment as any) || 'BEVERAGE_GENERIC',
    slug: d.slug || '',
    address: d.address || '',
    googlePlaceId: d.googlePlaceId || undefined,
    lat: d.lat ?? undefined,
    lng: d.lng ?? undefined,
  };
}

function payloadFromValues(values: StoreProfileFormValues) {
  return {
    name: values.name.trim(),
    logoUrl: values.logoUrl.trim() || null,
    category: values.category,
    subcategory: values.subcategory,
    segment: values.segment,
    slug: values.slug.trim() || undefined,
    address: values.address.trim() || undefined,
    googlePlaceId: values.googlePlaceId,
    lat: values.lat,
    lng: values.lng,
  };
}

export function BrandsPanel() {
  const { token, login, logout } = useOrganizerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastClaimUrl, setLastClaimUrl] = useState('');
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadDrafts() {
    if (!token) return;
    try {
      setDrafts(await api<DraftRow[]>('/stores/drafts'));
    } catch {
      setDrafts([]);
    }
  }

  useEffect(() => {
    void loadDrafts();
  }, [token]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión'
      );
    }
  }

  async function createDraft(values: StoreProfileFormValues) {
    setError('');
    if (!values.name.trim() || !values.category) {
      setError('Nombre y categoría son obligatorios');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ claimUrl: string }>('/stores/draft', {
        method: 'POST',
        body: JSON.stringify(payloadFromValues(values)),
      });
      setLastClaimUrl(res.claimUrl);
      await loadDrafts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el draft');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(id: string, values: StoreProfileFormValues) {
    setError('');
    setBusy(true);
    try {
      await api(`/stores/draft/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payloadFromValues(values)),
      });
      setEditingId(null);
      await loadDrafts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
  }

  async function rotateClaim(id: string) {
    const res = await api<{ claimUrl: string }>(
      `/stores/draft/${id}/rotate-claim`,
      { method: 'POST' }
    );
    await loadDrafts();
    setLastClaimUrl(res.claimUrl);
  }

  if (!token) {
    return (
      <form onSubmit={submitAuth} className="onda-card max-w-md space-y-4 p-6">
        <h3 className="font-display text-lg font-semibold">Acceso organizer</h3>
        <p className="text-sm text-[var(--onda-muted)]">
          Inicia sesión para crear negocios y generar links de asociación.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Correo</span>
          <input
            className="onda-input w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Contraseña</span>
          <input
            className="onda-input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {authError ? (
          <p className="text-sm text-[var(--onda-danger)]">{authError}</p>
        ) : null}
        <GradientButton type="submit" className="w-full">
          Entrar
        </GradientButton>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Negocios / marcas</h3>
          <p className="text-sm text-[var(--onda-muted)]">
            Crea un negocio sin dueño. Solo nombre y categoría son obligatorios; el
            resto puede completarse después.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-sm font-medium text-[var(--onda-primary-500)]"
        >
          Salir
        </button>
      </div>

      <div className="onda-card p-5">
        <h4 className="mb-4 font-display font-semibold">Nuevo negocio</h4>
        <StoreProfileForm
          initial={toFormValues({ category: StoreCategory.BRAND })}
          busy={busy && !editingId}
          error={editingId ? undefined : error}
          submitLabel="Crear y generar link"
          onSubmit={createDraft}
        />
        {lastClaimUrl ? (
          <div className="mt-4 rounded-xl bg-[var(--onda-sky-soft)] p-4 text-sm">
            <p className="font-medium text-[var(--onda-ink)]">Link de asociación</p>
            <p className="mt-1 break-all text-[var(--onda-muted)]">{lastClaimUrl}</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-[var(--onda-primary-500)]"
              onClick={() => void copyLink(lastClaimUrl)}
            >
              Copiar link
            </button>
          </div>
        ) : null}
      </div>

      <div className="onda-card space-y-3 p-5">
        <h4 className="font-display font-semibold">Pendientes de asociar</h4>
        {drafts.length === 0 ? (
          <p className="text-sm text-[var(--onda-muted)]">No hay drafts activos.</p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-[var(--onda-border)] p-3"
              >
                {editingId === d.id ? (
                  <StoreProfileForm
                    initial={toFormValues(d)}
                    busy={busy}
                    error={error}
                    submitLabel="Guardar cambios"
                    onSubmit={(values) => saveDraft(d.id, values)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {d.logoUrl ? (
                        <img
                          src={d.logoUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--onda-card)]">
                          {OndaIcons.product}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.name}</p>
                        <p className="text-xs text-[var(--onda-muted)]">
                          {STORE_CATEGORY_LABELS[d.category as StoreCategory] ||
                            d.category}
                          {' · '}
                          {STORE_SUBCATEGORY_LABELS[
                            d.subcategory as StoreSubcategory
                          ] || d.subcategory}
                          {d.address ? ` · ${d.address}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs"
                        onClick={() => {
                          setEditingId(d.id);
                          setError('');
                        }}
                      >
                        Editar
                      </button>
                      {d.claimUrl ? (
                        <button
                          type="button"
                          className="rounded-full bg-[var(--onda-sky-soft)] px-3 py-1 text-xs text-[var(--onda-sky)]"
                          onClick={() => void copyLink(d.claimUrl!)}
                        >
                          Copiar link
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs"
                        onClick={() => void rotateClaim(d.id)}
                      >
                        Rotar link
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
