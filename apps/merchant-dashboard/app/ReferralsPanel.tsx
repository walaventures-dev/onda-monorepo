'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  GradientButton,
  KpiCard,
  OndaIcons,
} from '@onda/shared-ui';
import { formatDateEs } from '@onda/shared-utils';

type ReferralSummary = {
  storeId: string;
  storeName: string;
  referralCode: string;
  freeMonthsBalance: number;
  referredStores: Array<{
    id: string;
    name: string;
    createdAt: string;
    slug: string;
  }>;
};

export function ReferralsPanel({ storeId }: { storeId: string }) {
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState('');

  const inviteLink =
    typeof window !== 'undefined' && data?.referralCode
      ? `${window.location.origin}/onboarding?ref=${data.referralCode}`
      : '';

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      setData(await api<ReferralSummary>(`/referrals/store/${storeId}`));
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar referidos');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (!data || !inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a Onda',
          text: `Regístrate en Onda con mi código ${data.referralCode} y empieza con un mes gratis.`,
          url: inviteLink,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await copy(inviteLink, 'link');
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">Cargando referidos…</p>
    );
  }

  if (error) {
    return <p className="text-sm text-[var(--onda-danger)]">{error}</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold">Referidos</h2>
        <p className="text-sm text-[var(--onda-muted)]">
          Comparte tu código: cada negocio que se registre te da 1 mes gratis
          acumulable.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Meses gratis"
          value={String(data.freeMonthsBalance)}
          hint="Incluye tu mes de bienvenida y bonos por referidos"
        />
        <KpiCard
          label="Negocios referidos"
          value={String(data.referredStores.length)}
        />
      </div>

      <div className="onda-card space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--onda-muted)]">
            Tu código
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-widest">
            {data.referralCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GradientButton
            type="button"
            onClick={() => copy(data.referralCode, 'code')}
          >
            {OndaIcons.copy}
            {copied === 'code' ? 'Copiado' : 'Copiar código'}
          </GradientButton>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--onda-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
            onClick={() => copy(inviteLink, 'link')}
          >
            {OndaIcons.copy}
            {copied === 'link' ? 'Link copiado' : 'Copiar link'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--onda-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
            onClick={share}
          >
            {OndaIcons.users}
            Compartir
          </button>
        </div>
        {inviteLink ? (
          <p className="break-all text-xs text-[var(--onda-muted)]">
            {inviteLink}
          </p>
        ) : null}
      </div>

      <div className="onda-card p-5">
        <h3 className="font-display text-lg font-semibold">
          Negocios que empezaron contigo
        </h3>
        {data.referredStores.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--onda-muted)]">
            Aún no hay referidos. Comparte tu link para sumar meses gratis.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--onda-border)]">
            {data.referredStores.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-[var(--onda-muted)]">/{s.slug}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--onda-muted)]">
                  {formatDateEs(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
