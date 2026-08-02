'use client';

import React, { useState } from 'react';
import { API_URL } from './api';

async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload ${res.status}`);
  }
  const data = (await res.json()) as { absoluteUrl?: string; url: string };
  return data.absoluteUrl || `${API_URL}${data.url}`;
}

export function ImageUploadField({
  value,
  onChange,
  label = 'Imagen',
  hint = 'JPG, PNG o WEBP · máx 2MB',
  className = '',
  aspectClass = 'aspect-square',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  className?: string;
  aspectClass?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file: File | null) {
    setError('');
    if (!file) {
      onChange('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen debe ser menor a 2MB');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (e: any) {
      setError(e.message || 'Error al subir');
      onChange('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      {label ? <p className="mb-2 text-sm font-medium">{label}</p> : null}
      <label
        className={`flex ${aspectClass} cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--onda-border)] bg-[var(--onda-bg)] text-center text-sm text-[var(--onda-muted)] hover:border-[var(--onda-violet)]`}
      >
        {uploading ? (
          <span>Subiendo…</span>
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-3">
            Haz clic para subir
            <br />
            <span className="text-xs">{hint}</span>
          </span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={uploading}
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </label>
      {value ? (
        <button
          type="button"
          className="mt-2 text-xs text-[var(--onda-danger)]"
          onClick={() => onChange('')}
        >
          Quitar imagen
        </button>
      ) : null}
      {error ? <p className="mt-1 text-xs text-[var(--onda-danger)]">{error}</p> : null}
    </div>
  );
}

export { uploadFile };
